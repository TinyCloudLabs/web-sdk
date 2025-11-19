import { Authenticator } from "./authenticator";
import { invoke } from "./tinycloud";

export class KV {
  constructor(private url: string, private auth: Authenticator) {}

  public async get(key: string): Promise<Response> {
    return await this.invoke({
      headers: this.auth.invocationHeaders("kv", "tinycloud.kv/get", key),
    });
  }

  public async head(key: string): Promise<Response> {
    return await this.invoke({
      headers: this.auth.invocationHeaders("kv", "tinycloud.kv/metadata", key),
    });
  }

  public async put(
    key: string,
    value: Blob,
    metadata: { [key: string]: string }
  ): Promise<Response> {
    return await this.invoke({
      body: value,
      headers: {
        ...metadata,
        ...this.auth.invocationHeaders("kv", "tinycloud.kv/put", key),
      },
    });
  }

  public async del(key: string): Promise<Response> {
    return await this.invoke({
      headers: this.auth.invocationHeaders("kv", "tinycloud.kv/del", key),
    });
  }

  public async list(prefix: string): Promise<Response> {
    return await this.invoke({
      headers: this.auth.invocationHeaders("kv", "tinycloud.kv/list", prefix),
    });
  }

  invoke = (params: { headers: HeadersInit; body?: Blob }): Promise<Response> =>
    invoke(this.url, params);
}
