# ZXTeam's Handbook Website

https://www.zxteam.org

## Development

### Jekyll via Docker
1. Build the site and make it available on a local server inside [Docker](https://www.docker.com/)
  ```shell
  docker run --interactive --rm --volume ${PWD}:/data --publish 4000:4000 zxteamorg/jekyll:20220815
  ```
1. Browse to http://127.0.0.1:4000

### Jekyll local
1. Install Jekyll. See https://jekyllrb.com/docs/
1. Build the site and make it available on a local server
	```shell
	cd docs
	bundle update
	jekyll serve --host 127.0.0.1 --port 4000
	```
1. Browse to http://127.0.0.1:4000


### Update Gemfile.lock

```shell
docker run --interactive --rm --volume ${PWD}:/data --entrypoint /bin/sh zxteamorg/jekyll:20220815 -c 'cd /data && bundle install'
```
