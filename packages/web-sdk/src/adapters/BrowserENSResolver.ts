import { IENSResolver } from "@tinycloud/sdk-core";
import { providers } from "ethers";

export class BrowserENSResolver implements IENSResolver {
  constructor(private provider: providers.Web3Provider) {}

  async resolveAddress(ensName: string): Promise<string | null> {
    return this.provider.resolveName(ensName);
  }

  async resolveName(address: string): Promise<string | null> {
    return this.provider.lookupAddress(address);
  }

  async resolveAvatar(ensName: string): Promise<string | null> {
    const resolver = await this.provider.getResolver(ensName);
    if (!resolver) return null;
    return resolver.getAvatar().then(a => a?.url ?? null).catch(() => null);
  }
}
