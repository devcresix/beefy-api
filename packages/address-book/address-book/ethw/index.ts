import { beefyfinance } from './platforms/beefyfinance';
import { lfg } from './platforms/lfg';
import { tokens } from './tokens/tokens';
import { convertSymbolTokenMapToAddressTokenMap } from '../../util/convertSymbolTokenMapToAddressTokenMap';
import Chain from '../../types/chain';
import { ConstInterface } from '../../types/const';

const _ethw = {
  platforms: {
    beefyfinance,
    lfg,
  },
  tokens,
  tokenAddressMap: convertSymbolTokenMapToAddressTokenMap(tokens),
};

export const ethw: ConstInterface<typeof _ethw, Chain> = _ethw;
