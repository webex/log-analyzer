# Architecture and Endpoints Reference

## Endpoints — service roles and descriptions

- **Webex SDK/Client** (Web or native app making the request): Chrome extension or any third-party web application that consumes the Webex Calling SDK.

- **Mobius**: Microservice that interworks between WebRTC and SIP to enable Webex Calling users to register and make calls using a web browser. It translates browser-originated signaling (HTTP/WSS) into SIP for backend communication.
  - **Mobius Multi-Instance Architecture**: Multiple Mobius servers are deployed across different geographic regions (e.g., US, EU, APAC). When a user initiates a call from their browser, their geolocation (based on IP) is used to route them to the nearest Mobius instance using a GeoDNS or load balancer.
  - Mobius talks to the following components:
    - **CPAPI** (Cisco Platform API): User entitlement and application metadata.
    - **CXAPI** (Webex Calling Call Control API): Stateless micro-service that implements the messaging logic behind the Webex Calling Call Control API. When incoming requests are received, it validates that the customer/user the request is made on behalf of belongs to Webex Calling and has the appropriate scope and roles. It then converts the request to the appropriate OCI requests and routes it to the OCIRouter to route to the correct WxC deployment.

- **U2C (User to Cluster)**: Microservice that helps services find other service instances across multiple Data Centers. It takes a user's email or UUID and optional service name, and returns the catalog containing the service URLs.

- **WDM (Webex squared Device Manager)**: Microservice responsible for registering a device and proxying feature toggles and settings for the user to bootstrap the Webex clients.
  - If WDM shows many 502 responses, possible failing dependencies: Common Identity CI, Mercury API, U2C, Feature Service, Cassandra, Redis.
  - If WDM is generating errors, either Locus will produce 502 responses or the clients will show an error.

- **SSE (Signalling Service Edge)**: Edge component for SIP signalling. It communicates with two endpoints — Mobius and the application server WxCAS.

- **MSE (Media Service Engine)**: Edge component for media relay that handles RTP for WebRTC clients.

- **Webex Calling Application Server (WxCAS)**: Core control application in Webex Calling responsible for enabling communication between source SSE and destination SSE.

- **Mercury**: Webex's real-time messaging and signaling service that establishes WebSocket connections and exchanges information in the form of events. Mobius uses Mercury to send events to the SDK. The SDK establishes a Mercury connection (WebSocket) to receive communication from Mobius.

---

For **WebRTC Calling** flow details (signaling path, media path, call types & routing), see **references/calling_flow.md**.

For **Contact Center** flow details (signaling path, media path, Kamailio/RTMS/RAS, health ping, timers, Kafka failover, inter-regional failover), see **references/contact_center_flow.md**.
