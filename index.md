---
layout: default
title: Welcome
nav_order: 1
description: "TBD"
permalink: /
---

# Welcome

<p align="center" width="100%">
    <img src="assets/images/edgebus-overview-architecture.png" alt="EdgeBus Overview Architecture">
</p>

EdgeBus is a library and standalone server application that makes your life easy in integration of different systems and make development a fun and easy experience.

There are two main goals:
* **Asynchronous Messages** - manage, audit, transform, guarantee delivery
* **Synchronous Calls** - audit, transform, retry

## Asynchronous Messages

Basically, these days, mostly each project requires to receive and deliver asynchronous messages with external systems.
There are a lot of terrible parts to handle this task such a guaranteed delivery, audit, manage event endpoints.

EdgeBus provides set of features in scope related to Asynchronous Messages:

* Audit messages and delivery evidences
* Performance counters
* Delivery retry policy
* [Protocol switching]({{ "/glossary/#protocol-switching" | relative_url }})
* Transform payload
* Manual retry message delivery

Similar products:

* [Amazon SNS](https://docs.aws.amazon.com/sns/latest/dg/welcome.html)
* [Azure Service Bus](https://azure.microsoft.com/en-us/products/service-bus/)
* [Google Cloud Pub/Sub](https://cloud.google.com/pubsub)
* [Pipedream](https://pipedream.com) - Workflow automation for developers


## Synchronous Calls

If your application is not lived in a vacuum it, probably, call to external API(s) to obtain data.
Unfortunately, a lot of developers have thoughts the external system always available and network always no issues.

EdgeBus provides set of features in scope related to Synchronous Calls:

* Audit calls
* Performance counters
* [Protocol switching]({{ "/glossary/#protocol-switching" | relative_url }})
* Transform payload
* Reverse proxy

Similar products:

* [ngrok](https://ngrok.com/)

{: .note }
Join our [Google Group](TBD) to ask questions.
