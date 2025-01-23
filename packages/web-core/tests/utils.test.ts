import {
  getProvider,
  TCWRPCProvider,
  TCWRPCProviders,
  tcwResolveEns,
} from '../src';

const tcwRPCProviders: Record<string, TCWRPCProvider> = {
  etherscan: {
    service: TCWRPCProviders.TCWEtherscanProvider,
  },
  infura: {
    service: TCWRPCProviders.TCWInfuraProvider,
  },
  alchemy: {
    service: TCWRPCProviders.TCWAlchemyProvider,
  },
  cloudflare: {
    service: TCWRPCProviders.TCWCloudflareProvider,
  },
  pocket: {
    service: TCWRPCProviders.TCWPocketProvider,
  },
  ankr: {
    service: TCWRPCProviders.TCWAnkrProvider,
  },
  custom: {
    service: TCWRPCProviders.TCWCustomProvider,
  },
};

test('Should get Etherscan Provider successfully', () => {
  let provider;
  expect(() => {
    provider = getProvider(tcwRPCProviders.etherscan);
  }).not.toThrowError();

  expect(provider.baseUrl).toEqual('https://api.etherscan.io');
});

test('Should get Infura Provider successfully', () => {
  let provider;
  expect(() => {
    provider = getProvider(tcwRPCProviders.infura);
  }).not.toThrowError();

  expect(provider.connection).toEqual(
    expect.objectContaining({
      url: 'https://mainnet.infura.io/v3/84842078b09946638c03157f83405213',
    })
  );
});

test('Should get Alchemy Provider successfully', () => {
  let provider;
  expect(() => {
    provider = getProvider(tcwRPCProviders.alchemy);
  }).not.toThrowError();

  expect(provider.connection).toEqual(
    expect.objectContaining({
      url: 'https://eth-mainnet.alchemyapi.io/v2/_gg7wSSi0KMBsdKnGVfHDueq6xMB9EkC',
    })
  );
});

test('Should get Cloudflare Provider successfully', () => {
  let provider;
  expect(() => {
    provider = getProvider(tcwRPCProviders.cloudflare);
  }).not.toThrowError();

  expect(provider.connection).toEqual(
    expect.objectContaining({
      url: 'https://cloudflare-eth.com/',
    })
  );
});

test('Should get Poket Provider successfully', () => {
  let provider;
  expect(() => {
    provider = getProvider(tcwRPCProviders.pocket);
  }).not.toThrowError();

  expect(provider.connection).toEqual(
    expect.objectContaining({
      url: 'https://eth-mainnet.gateway.pokt.network/v1/lb/62e1ad51b37b8e00394bda3b',
    })
  );
});

test('Should get Ankr Provider successfully', () => {
  let provider;
  expect(() => {
    provider = getProvider(tcwRPCProviders.ankr);
  }).not.toThrowError();

  expect(provider.connection).toEqual(
    expect.objectContaining({
      url: 'https://rpc.ankr.com/eth/9f7d929b018cdffb338517efa06f58359e86ff1ffd350bc889738523659e7972',
    })
  );
});

test('Should get Custom Provider successfully', () => {
  let provider;
  expect(() => {
    provider = getProvider(tcwRPCProviders.custom);
  }).not.toThrowError();

  expect(provider.connection).toEqual(
    expect.objectContaining({
      url: 'http://localhost:8545',
    })
  );
});

test('Should get default Provider successfully', () => {
  let provider;
  expect(() => {
    provider = getProvider();
  }).not.toThrowError();
});

test('Should fail to resolve ENS domain', async () => {
  const provider = getProvider(tcwRPCProviders.goerli);
  await expect(tcwResolveEns(provider, '')).rejects.toThrow();
}, 30000);

test('Should resolve ENS domain successfully', async () => {
  const provider = getProvider(tcwRPCProviders.goerli);
  await expect(
    tcwResolveEns(provider, '0x96F7fB7ed32640d9D3a982f67CD6c09fc53EBEF1', {
      domain: true,
      avatar: false,
    })
  ).resolves.not.toThrow();
}, 30000);

test('Should resolve ENS avatar successfully', async () => {
  const provider = getProvider(tcwRPCProviders.goerli);
  await expect(
    tcwResolveEns(provider, '0x96F7fB7ed32640d9D3a982f67CD6c09fc53EBEF1', {
      domain: false,
      avatar: true,
    })
  ).resolves.not.toThrow();
}, 30000);

test('Should resolve ENS domain and avatar successfully', async () => {
  const provider = getProvider(tcwRPCProviders.goerli);
  await expect(
    tcwResolveEns(provider, '0x96F7fB7ed32640d9D3a982f67CD6c09fc53EBEF1', {
      domain: true,
      avatar: true,
    })
  ).resolves.not.toThrow();
}, 30000);
