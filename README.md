# EdgeBus

[EdgeBus](https://docs.edgebus.io) is an application level network edge bus that adds connectivity, auditability, and observability to your apps with no code changes.

# TypeScript of EdgeBus Service

[![npm version badge](https://img.shields.io/npm/v/@zxteam/identity.service.svg)](https://www.npmjs.com/package/@zxteam/notification.service)
[![downloads badge](https://img.shields.io/npm/dm/@zxteam/identity.service.svg)](https://www.npmjs.org/package/@zxteam/notification.service)
[![commit activity badge](https://img.shields.io/github/commit-activity/m/zxteamorg/node.notification.service)](https://github.com/zxteamorg/node.notification.service/pulse)
[![last commit badge](https://img.shields.io/github/last-commit/zxteamorg/node.notification.service)](https://github.com/zxteamorg/node.notification.service/graphs/commit-activity)
[![twitter badge](https://img.shields.io/twitter/follow/zxteamorg?style=social&logo=twitter)](https://twitter.com/zxteamorg)

This is `src-typescript-service` branch of **EdgeBus** multi project repository based on [orphan](https://git-scm.com/docs/git-checkout#Documentation/git-checkout.txt---orphanltnew-branchgt) branches.

## Developer Notes

### Start locally

```shell
cp .env-example .env
nvm use 22
npm install
npm run build
npm start
```

Check 



## General information

### Use-cases

```mermaid
sequenceDiagram
	participant Subscriber1
	participant Subscriber2
	participant `EdgeBus`
	participant Ingress
	opt Event A happend
		Ingress->>`EdgeBus`: Message A for "my" topic
		`EdgeBus`->>`EdgeBus`: Skip, just audit
	end
	Subscriber2->>+`EdgeBus`: Subscribe "my" topic
	`EdgeBus`-->>-Subscriber2: OK
	opt Event B happend
		Ingress->>`EdgeBus`: Message B for "my" topic
		`EdgeBus`->>+Subscriber2: Message B for "my" topic
		Subscriber2-->>-`EdgeBus`: OK
	end
	Subscriber1->>+`EdgeBus`: Subscribe "my" topic
	`EdgeBus`-->>-Subscriber1: OK
	opt Event C happend
		Ingress->>`EdgeBus`: Message C for "my" topic
		`EdgeBus`->>+Subscriber2: Message C for "my" topic
		Subscriber2-->>-`EdgeBus`: OK
		`EdgeBus`->>+Subscriber1: Message C for "my" topic
		Subscriber1-->>-`EdgeBus`: OK
	end
	Subscriber1->>+`EdgeBus`: UNsubscribe "my" topic
	`EdgeBus`-->>-Subscriber1: OK
	opt Event D happend
		Ingress->>`EdgeBus`: Message D for "my" topic
		`EdgeBus`->>+Subscriber2: Message D for "my" topic
		Subscriber2-->>-`EdgeBus`: OK
	end
```

### Delivery
Messages are sent immediately after an operation was performed.

`EdgeBus` records the fact of message delivery to your system after receiving the response from your system.

If message delivery is failed the server will retry with delay between attempts according to a scale was choosen at subscription phase.

For example powers of two scale will retry delivery until the period does not exceed 16384 seconds (~4.5hours): 1, 2, 4, 8, 16, ..., 16384(max).

Notification server performs attempts to deliver a message within 3 days.

### Selecting delivery format
Along with setup your notification endpoint, you may choose message format.

#### [JSON-RPC](https://www.jsonrpc.org/specification)
Using JSON-RPC in notification manner
```JSON
--> {"jsonrpc": "2.0", "method": "somethingChanged", "params": { "id": "68ac6741f92d41fbbc894ab406fcc91d", ...... }}
--> {"jsonrpc": "2.0", "method": "somethingAdded", "params": { "id": "3d80cbbe", ...... }}
```

#### [Protocol Buffers Version 2](https://developers.google.com/protocol-buffers/docs/reference/proto2-spec)
Using Protocol Buffers for message serialization. See definition .proto file for details.

### Message security
`EdgeBus` does tranfer messages as-is. There is `Ingress`'s responsibility to provide desired kind of security like **encrypting**, **signing**, etc.

However implementation of **egresses** may provide additional security. For example Webhook provides a token header and SSL validation. See a egress documentation for details.

## Administration flow
```mermaid
sequenceDiagram
	participant Admin
	participant Ingress
	participant EdgeBus
	participant Egress
	opt Setup topic
		Admin->>EdgeBus: Create topic "my-topic"
		EdgeBus-->>Admin: Create topic "my-topic"
	end
	opt Security
		Admin->>Egress: Subscribe Token: XXXX
		Egress-->>Admin: Thanks
	end
	opt Security
		Admin->>Ingress: Publish Token: XXXX
		Ingress-->>Admin: Thanks
	end
	opt Setup
	Egress->>EdgeBus: Setup egress
	EdgeBus-->>Egress: Subscription details
	end
	opt Setup
	Ingress->>EdgeBus: Setup ingress
	EdgeBus-->>Ingress: Publication details
	end
	opt General use
		Ingress->>EdgeBus: Publish a message
		EdgeBus->>Egress: Deliver the message
	end
```


## Messages
### Life-cycle
```mermaid
graph TD
    NEW --> ON_THE_WAY
    ON_THE_WAY --> ON_THE_WAY
    NEW --> CANCELLED
    ON_THE_WAY --> CANCELLED
    ON_THE_WAY --> DELIVERED
    ON_THE_WAY --> REJECTED
```

## Topics

### Life-cycle
```mermaid
graph TD
	CREARETOPIC(Create) --> TOPIC
	TOPIC --> TOPIC
	TOPIC --> DELETEDTOPIC(Destroy)
```

### Setup

#### List Topics
##### Request for public topic
```bash
$ curl --verbose --request GET https://notifier.zxteam.org/management/topic
```

##### Request for private topic
```bash
$ curl --verbose --key ./admin-key.pem --cert ./admin-cert.pem --request GET https://notifier.zxteam.org/management/topic
```

##### Response
```json
[
	{
		"name": "MyGitLabPushTopic.yourdomain.ltd",
		"mediaType":"application/json",
		"description":"...",
		"createAt":"2020-01-14T22:17:32.324Z",
		"deleteAt":null
	},
	{
		"name": "MyGitLabPushTopic2.yourdomain.ltd",
		"mediaType":"application/json",
		"description":"...",
		"createAt":"2020-01-14T22:17:32.324Z",
		"deleteAt":null
	},
	...
]
```

#### Create Topic
##### Body
```bash
$ cat docs/topic/create-topic.json
```
```json
{
	"name": "MyGitLabPushTopic",
	"description": "My first topic to handle GitLab's push events. See https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#push-events",
	"schema": {
		"$schema": "http://json-schema.org/draft-07/schema",
		...
	}
}
```

##### Request for public topic
```bash
$ curl --verbose --request POST --header 'Content-Type: application/json' https://notifier.zxteam.org/management/topic --data @docs/topic/create-topic.json
```

##### Request for private topic
```bash
$ curl --verbose --key ./admin-key.pem --cert ./admin-cert.pem --request POST --header 'Content-Type: application/json'  https://notifier.zxteam.org/management/topic --data @docs/topic/create-topic.json
```

##### Response
```json
{
	"name": "MyGitLabPushTopic.yourdomain.ltd",
	"security": {
		"kind": "TOKEN",
		"token": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
	}
}
```
NOTE: `yourdomain.ltd` is comming from your SSL certificate `admin-cert.pem` (field: CN)

#### Delete Topic
```bash
$ cat docs/topic/delete-topic.json
```
```json
{
	"topicSecurity": {
		"kind": "TOKEN",
		"token": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
	}
}
```
```bash
$ curl --verbose --request DELETE --header 'Content-Type: application/json' https://notifier.zxteam.org/management/MyGitLabPushTopic.yourdomain.ltd --data @docs/topic/delete-topic.json
```
```json
{
	"deleteDate": "2019-10-10T12:00:01.223Z",
	"pendingMessages": 342,
	"totalMessages": 444321
}
```


## Publishers
Any ingress may be deleted by following request
```bash
$ cat docs/ingress/delete-ingress.json
```
```json
{
	"publisherSecurity": {
		"kind": "TOKEN",
		"token": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
	},
	"ssl": {
		... optional
	}
}
```
```bash
$ curl --verbose --request DELETE --header 'Content-Type: application/json' https://notifier.zxteam.org/management/ingress/ingress.http.641f97ec-31d0-418b-a594-0e9aa3a356a5 --data @docs/ingress/delete-ingress.json
```
```json
{
	"deleteDate": "2019-10-10T12:00:01.223Z"
}
```

### HTTP Endpoint
HTTP Ingress allows to publish messages via HTTP protocol.

#### Create ingress endpoint
```bash
$ cat docs/ingress/create-http-ingress.json
```
```json
{
	"topic": "MyGitLabPushTopic.yourdomain.ltd",
	"publisherSecurity": {
		"kind": "TOKEN",
		"token": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
	},
	"ssl": {
		... optional
	}
}
```
```bash
$ curl --verbose --request POST --header 'Content-Type: application/json' https://notifier.zxteam.org/management/ingress/http --data @docs/ingress/create-http-ingress.json
```
```json
{
	"ingressId": "ingress.http.18af3285-749a-4fe8-abc0-52a42cd82cb6",
	"url": "https://notifier.zxteam.org/ingress/http/18af3285-749a-4fe8-abc0-52a42cd82cb6"
}
```
#### Push message
```bash
curl --verbose --header 'Content-Type: application/json' https://notifier.zxteam.org/ingress/http/18af3285-749a-4fe8-abc0-52a42cd82cb6 --data '{"hello":"world"}'
```


## Subscribers
### List egresss (GET)
```bash
$ curl --verbose --request GET 'https://notifier.zxteam.org/management/egress?security.kind=TOKEN&security.token=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```
```json
[
	{
		"kind": "webhook",
		"egressId": "egress.webhook.23c3167c-910f-486d-966b-89ac59c6080a",
		...
	},
	{
		"kind": "webhook",
		"egressId": "egress.webhook.c3e57dd6-f5c9-4cf3-9ed5-8747bcec4372",
		...
	},
	{
		"kind": "websockethost",
		"egressId": "egress.websockethost.18af3285-749a-4fe8-abc0-52a42cd82cb6",
		...
	},
	...
]
```

### Delete egress (DELETE)
```bash
$ cat docs/egress/delete-egress.json
```
```json
{
	"security": {
		"kind": "TOKEN",
		"token": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
	}
}
```
```bash
$ curl --verbose --request DELETE --header 'Content-Type: application/json' https://notifier.zxteam.org/management/egress/egress.webhook.2733f6e9-c405-46d1-969e-2b42e4a4dc42 --data @docs/egress/delete-egress.json
```
```json
{
	"deleteDate": "2019-10-10T12:00:01.223Z"
}
```


### Webhook
[Webhooks](https://en.wikipedia.org/wiki/Webhook) are "user-defined HTTP
callbacks".
When an event occurs, `EdgeBus` makes an HTTP request to the URI configured for the webhook.

>>>
**Warning:** Your endpoint should ALWAYS return a valid HTTP response with HTTP status 2XX. If you do not do this then EdgeBus will think the hook failed and [retry](#delivery) it.
>>>

#### SSL verification
SSL Verification enables automatically for URL scheme `https:`. No additional configuration required.

>>>
**Optional:** If you specify a CA Certificates in a `trustedCA` field of create egress request, it will be used to verify the SSL certificate of the webhook endpoint.
If `trustedCA` is omited the SSL certificate of the webhook endpoint is verified based on an internal list of Certificate Authorities.
>>>

#### Secret token
If you specify a secret token in a `headerToken` field of create egress request, it will be sent along with the hook request in the **NF-TOKEN** HTTP header.

#### Create egress endpoint
```bash
$ cat docs/egress/create-webhook-egress.json
```
```json
{
	"topic": "MyGitHubEventsTopic.yourdomain.ltd",
	"egressSecurity": {
		"kind": "TOKEN",
		"token": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
	},
	"url": "https://callback.yourdomain.ltd/my-github-commits",
	"trustedCA": "-----BEGIN CERTIFICATE-----\nMII.....\n-----END CERTIFICATE-----", // ...optional
	"headerToken": "my-secret-words-for-NF-TOKEN-header", // ...optional
	"transformers": [ // ...optional
	]
}
```
```bash
$ curl --verbose --request POST --header 'Content-Type: application/json' https://notifier.zxteam.org/egress/webhook --data @docs/egress/create-webhook-egress.json
```
```json
{
	"kind": "webhook",
	"egressId": "egress.webhook.23c3167c-910f-486d-966b-89ac59c6080a",
	"topic": "MyGitHubEventsTopic.yourdomain.ltd",
	"url": "https://callback.yourdomain.ltd/my-github-commits",
	"trustedCA": "-----BEGIN CERTIFICATE-----\nMII.....\n-----END CERTIFICATE-----", // ...optional
	"headerToken": "my-secret-words-for-NF-TOKEN-header", // ...optional
	"transformers": [ // ...optional
	]
}
```


### WebSocket (Host Mode)
This kind of egress allows to receive messages through WebSocket channel. `Host Mode` means that message egress connects to `EdgeBus` as client.

#### Create egress endpoint
```bash
$ cat docs/egress/create-websocket-host-egress.json
```
```json
{
	"topic": "MyGitLabPushTopic.yourdomain.ltd",
	"egressSecurity": {
		"kind": "TOKEN",
		"token": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
	},
	"ssl": {
		... optional
	}
}
```
```bash
$ curl --verbose --request POST --header 'Content-Type: application/json' https://notifier.zxteam.org/egress/websockethost --data @docs/egress/create-websocket-host-egress.json
```
```json
{
	"kind": "websockethost",
	"egressId": "egress.websockethost.18af3285-749a-4fe8-abc0-52a42cd82cb6",
	"url": "wss://notifier.zxteam.org/egress/websockethost/18af3285-749a-4fe8-abc0-52a42cd82cb6"
}
```
#### Listen egress endpoint
```
wscat --connect wss://notifier.zxteam.org/egress/websockethost/18af3285-749a-4fe8-abc0-52a42cd82cb6
```



https://api.telegram.org/bot957337804:AAEfHSDXPDKJtWbyHB-e09579zmC-_h7SLE/getMe
https://api.telegram.org/bot957337804:AAEfHSDXPDKJtWbyHB-e09579zmC-_h7SLE/getUpdates
```json
{"ok":true,"result":[
	{"update_id":554918867,"message":{"message_id":2,"from":{"id":867014308,"is_bot":false,"first_name":"Maksym","last_name":"Anurin","username":"theanurin","language_code":"en"},"chat":{"id":867014308,"first_name":"Maksym","last_name":"Anurin","username":"theanurin","type":"private"},"date":1577446910,"text":"\u043f\u0440\u0438\u0432\u0435\u0442"}},
	{"update_id":554918868,
"message":{"message_id":5,"from":{"id":867014308,"is_bot":false,"first_name":"Maksym","last_name":"Anurin","username":"theanurin","language_code":"en"},"chat":{"id":-383073836,"title":"CPEmulatorNotification","type":"group","all_members_are_administrators":true},"date":1577447428,"group_chat_created":true}},{"update_id":554918869,
"message":{"message_id":6,"from":{"id":867014308,"is_bot":false,"first_name":"Maksym","last_name":"Anurin","username":"theanurin","language_code":"en"},"chat":{"id":-383073836,"title":"CPEmulatorNotification","type":"group","all_members_are_administrators":true},"date":1577447460,"new_chat_participant":{"id":384745746,"is_bot":false,"first_name":"Vladimir","last_name":"Syniakin"},"new_chat_member":{"id":384745746,"is_bot":false,"first_name":"Vladimir","last_name":"Syniakin"},"new_chat_members":[{"id":384745746,"is_bot":false,"first_name":"Vladimir","last_name":"Syniakin"}]}},{"update_id":554918870,
"message":{"message_id":7,"from":{"id":867014308,"is_bot":false,"first_name":"Maksym","last_name":"Anurin","username":"theanurin","language_code":"en"},"chat":{"id":-383073836,"title":"CPEmulatorNotification","type":"group","all_members_are_administrators":true},"date":1577447489,"text":"/start","entities":[{"offset":0,"length":6,"type":"bot_command"}]}}]}
```

curl -v -X POST --header "Content-Type: application/json" --data '{"chat_id":"-383073836","text":"`hello` amigo","parse_mode":"Markdown"}' https://api.telegram.org/bot957337804:AAEfHSDXPDKJtWbyHB-e09579zmC-_h7SLE/sendMessage



```bash
curl https://api.telegram.org/bot1036097604:AAHLVqwfabEmFu4Ou4nmCYXxAo2ffjB3Mmo/getMe
```
```json
{"ok":true,"result":{"id":1036097604,"is_bot":true,"first_name":"ZXTeam\u2019s EdgeBus","username":"zxteam_notifier_bot"}}
```

```bash
curl https://api.telegram.org/bot1036097604:AAHLVqwfabEmFu4Ou4nmCYXxAo2ffjB3Mmo/getUpdates
```
```json
{
	"ok":true,
	"result":[
		{
			"update_id":807119542,
			"message":{
				"message_id":1,
				"from":{
					"id":867014308,
					"is_bot":false,
					"first_name":"Maksym",
					"last_name":"Anurin",
					"username":"theanurin"
				},
				"chat":{
					"id":-347824729,"title":"ZXTeam\u2019s EdgeBus",
					"type":"group",
					"all_members_are_administrators":true
				},
				"date":1577452660,
				"group_chat_created":true
			}
		},
		{
			"update_id":807119543,
			"message":{
				"message_id":2,
				"from":{"id":277364372,"is_bot":false,"first_name":"Serhii","last_name":"Zghama","username":"serhiizghama"},
				"chat":{"id":-347824729,"title":"ZXTeam\u2019s EdgeBus","type":"group","all_members_are_administrators":true},
				"date":1577452697,
				"text":"/hello",
				"entities":[{"offset":0,"length":6,"type":"bot_command"}]
			}
		}
]
}
`

curl -v -X POST --header "Content-Type: application/json" --data '{"chat_id":"-347824729","text":"{\\"echo\\":\\"hello\\",\\"time\\":\\"2019-12-27T13:25:18.341Z\\",\\"version\\":\\"0.0.3\\"}"}' https://api.telegram.org/bot1036097604:AAHLVqwfabEmFu4Ou4nmCYXxAo2ffjB3Mmo/sendMessage
