import { tinycloud } from '@tinycloudlabs/web-sdk-wasm';

type TinyCloudModule = typeof tinycloud;
const msg =
  "Has TinyCloud been initialised? 'global.tinycloudModule' is not of the expected type";

function getModule(): TinyCloudModule {
  try {
    return global.tinycloudModule;
  } catch (e) {
    throw `${msg}: ${e}`;
  }
}

export const makeSpaceId: TinyCloudModule['makeSpaceId'] = (...args) => {
  try {
    return getModule().makeSpaceId(...args);
  } catch (e) {
    throw `${msg}: ${e}`;
  }
};

export const prepareSession: TinyCloudModule['prepareSession'] = (...args) => {
  try {
    return getModule().prepareSession(...args);
  } catch (e) {
    throw `${msg}: ${e}`;
  }
};

export const completeSessionSetup: TinyCloudModule['completeSessionSetup'] = (
  ...args
) => {
  try {
    return getModule().completeSessionSetup(...args);
  } catch (e) {
    throw `${msg}: ${e}`;
  }
};

export const invoke: TinyCloudModule['invoke'] = (...args) => {
  try {
    return getModule().invoke(...args);
  } catch (e) {
    throw `${msg}: ${e}`;
  }
};

export const generateHostSIWEMessage: TinyCloudModule['generateHostSIWEMessage'] =
  (...args) => {
    try {
      return getModule().generateHostSIWEMessage(...args);
    } catch (e) {
      throw `${msg}: ${e}`;
    }
  };

export const siweToDelegationHeaders: TinyCloudModule['siweToDelegationHeaders'] =
  (...args) => {
    try {
      return getModule().siweToDelegationHeaders(...args);
    } catch (e) {
      throw `${msg}: ${e}`;
    }
  };
