# services: optional, stateless (future)

Nothing lives here yet. Lakshly's Free tier needs **no server**. If a relay is ever needed (for example Plaid webhooks, only if the app goes global), it will be a stateless edge function that **never stores user financial data** and only passes encrypted payloads to the client.

The in-app feedback relay lives in [`workers/feedback/`](../workers/feedback/README.md): a stateless Cloudflare Worker that turns feedback into issues in a private GitHub repo. It never receives financial data.
