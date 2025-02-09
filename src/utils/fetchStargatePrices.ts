import BigNumber from 'bignumber.js';
import { MultiCall } from 'eth-multicall';
import { web3Factory, multicallAddress } from './web3';
import StargateLP from '../abis/StargateLP.json';

import {
  FANTOM_CHAIN_ID,
  BSC_CHAIN_ID,
  AVAX_CHAIN_ID,
  OPTIMISM_CHAIN_ID,
  ARBITRUM_CHAIN_ID,
  POLYGON_CHAIN_ID,
  ETH_CHAIN_ID,
} from '../constants';
import { addressBook } from '../../packages/address-book/address-book';
import { getContract } from './contractHelper';

const {
  bsc: {
    tokens: { USDT, sbUSDT, BUSD, sbBUSD },
  },
  fantom: {
    tokens: { USDC, sfUSDC },
  },
  avax: {
    tokens: { saUSDT, saUSDC },
  },
  optimism: {
    tokens: { soUSDC, ETH, soETH },
  },
  arbitrum: {
    tokens: { sarUSDC, sarUSDT, sarETH },
  },
  polygon: {
    tokens: { spUSDC, spUSDT },
  },
  ethereum: {
    tokens: { sethUSDC, sethUSDT, sethETH },
  }
} = addressBook;

const tokens = {
  bsc: [
    [USDT, sbUSDT],
    [BUSD, sbBUSD],
  ],
  fantom: [[USDC, sfUSDC]],
  avax: [
    [USDT, saUSDT],
    [USDC, saUSDC],
  ],
  optimism: [
    [USDC, soUSDC],
    [ETH, soETH],
  ],
  arbitrum: [
    [USDC, sarUSDC],
    [USDT, sarUSDT],
    [ETH, sarETH],
  ],
  polygon: [
    [USDT, spUSDT],
    [USDC, spUSDC],
  ],
  ethereum: [
    [USDC, sethUSDC],
    [USDT, sethUSDT],
    [ETH, sethETH],
  ]
};

const getStargatePrices = async (tokenPrices, tokens, chainId) => {
  const web3 = web3Factory(chainId);
  const multicall = new MultiCall(web3, multicallAddress(chainId));

  const stakedInsPoolCalls = [];
  const totalsSupplyCalls = [];

  tokens.forEach(token => {
    const tokenContract = getContract(StargateLP, token[1].address);
    stakedInsPoolCalls.push({
      stakedInsPool: tokenContract.methods.totalLiquidity(),
    });
    totalsSupplyCalls.push({
      totalsSupply: tokenContract.methods.totalSupply(),
    });
  });

  let res;
  try {
    res = await multicall.all([stakedInsPoolCalls, totalsSupplyCalls]);
  } catch (e) {
    console.error('getStargatePrices', e);
    return tokens.map(() => 0);
  }
  const stakedInsPool = res[0].map(v => new BigNumber(v.stakedInsPool));
  const totalsSupply = res[1].map(v => new BigNumber(v.totalsSupply));

  return stakedInsPool.map((v, i) =>
    v.times(tokenPrices[tokens[i][0].symbol]).dividedBy(totalsSupply[i]).toNumber()
  );
};

const fetchStargatePrices = async tokenPrices =>
  Promise.all([
    getStargatePrices(tokenPrices, tokens.fantom, FANTOM_CHAIN_ID),
    getStargatePrices(tokenPrices, tokens.bsc, BSC_CHAIN_ID),
    getStargatePrices(tokenPrices, tokens.avax, AVAX_CHAIN_ID),
    getStargatePrices(tokenPrices, tokens.optimism, OPTIMISM_CHAIN_ID),
    getStargatePrices(tokenPrices, tokens.arbitrum, ARBITRUM_CHAIN_ID),
    getStargatePrices(tokenPrices, tokens.polygon, POLYGON_CHAIN_ID),
    getStargatePrices(tokenPrices, tokens.ethereum, ETH_CHAIN_ID),
  ]).then(data =>
    data
      .flat()
      .reduce((acc, cur, i) => ((acc[Object.values(tokens).flat()[i][1].symbol] = cur), acc), {})
  );

export { fetchStargatePrices };
