export type ClusterOption = {
  endpoint: string;
  id: "devnet" | "localnet";
  label: string;
  websocketEndpoint: string;
};

export const clusterOptions: ClusterOption[] = [
  {
    id: "localnet",
    label: "Localnet",
    endpoint: "http://127.0.0.1:8899",
    websocketEndpoint: "ws://127.0.0.1:8900",
  },
  {
    id: "devnet",
    label: "Devnet",
    endpoint: "https://api.devnet.solana.com",
    websocketEndpoint: "wss://api.devnet.solana.com",
  },
];

export function findClusterOption(endpoint: string) {
  return clusterOptions.find((option) => option.endpoint === endpoint);
}

export function formatEndpointHost(endpoint: string) {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

