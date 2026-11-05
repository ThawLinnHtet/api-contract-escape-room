import { neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Keep the managed environment's proxy and CA trust for WebSocket traffic.
export function configureNeonTransport() {
  const proxy = process.env.HTTPS_PROXY;
  const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;
  neonConfig.webSocketConstructor = class extends WebSocket {
    constructor(address: string, protocols?: string | string[], options?: WebSocket.ClientOptions) {
      super(address, protocols, { ...options, agent });
    }
  };
}
