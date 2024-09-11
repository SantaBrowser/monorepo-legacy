import { ChainId } from '@thxnetwork/common/enums';
import { ChainInfo } from '@thxnetwork/dashboard/types/ChainInfo';

const chainInfo: { [chainId: number]: ChainInfo } = {
    [ChainId.Ethereum]: {
        disabled: true,
        chainId: ChainId.Ethereum,
        name: 'Ethereum',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_ethereum.svg'),
        blockExplorer: 'https://etherscan.com',
    },
    [ChainId.Sepolia]: {
        disabled: false,
        chainId: ChainId.Sepolia,
        name: 'Sepolia',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_sepolia.svg'),
        blockExplorer: 'https://sepolia.etherscan.io',
    },
    [ChainId.Skale]: {
        disabled: false,
        chainId: ChainId.Skale,
        name: 'Skale',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_skale.svg'),
        blockExplorer: 'https://juicy-low-small-testnet.explorer.testnet.skalenodes.com',
    },
    [ChainId.Arbitrum]: {
        disabled: false,
        chainId: ChainId.Arbitrum,
        name: 'Arbitrum',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_arbitrum.svg'),
        blockExplorer: 'https://arbiscan.io',
    },
    [ChainId.Optimism]: {
        disabled: false,
        chainId: ChainId.Optimism,
        name: 'Optimism',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_optimism.svg'),
        blockExplorer: 'https://optimistic.etherscan.io',
    },
    [ChainId.BNBChain]: {
        disabled: true,
        chainId: ChainId.BNBChain,
        name: 'Binance Smart Chain',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_bsc.svg'),
        blockExplorer: 'https://mumbai.polygonscan.com',
    },
    [ChainId.Polygon]: {
        disabled: false,
        chainId: ChainId.Polygon,
        name: 'Polygon',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_polygon.svg'),
        blockExplorer: 'https://polygonscan.com',
    },
    [ChainId.PolygonZK]: {
        disabled: true,
        chainId: ChainId.PolygonZK,
        name: 'Polygon zkEVM',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_polygon.svg'),
        blockExplorer: 'https://zkevm.polygonscan.com',
    },
    [ChainId.Linea]: {
        disabled: true,
        chainId: ChainId.Linea,
        name: 'Linea',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_linea.svg'),
        blockExplorer: 'https://lineascan.build',
    },
    [ChainId.Metis]: {
        disabled: true,
        chainId: ChainId.Metis,
        name: 'Metis',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_metis.svg'),
        blockExplorer: 'https://explorer.metis.io',
    },
    [ChainId.Base]: {
        disabled: false,
        chainId: ChainId.Base,
        name: 'Base',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_base.svg'),
        blockExplorer: 'https://basescan.org',
    },
    [ChainId.IOTA]: {
        disabled: true,
        chainId: ChainId.IOTA,
        name: 'IOTA EVM',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_iota.svg'),
        blockExplorer: 'https://explorer.evm.iota.org',
    },
    [ChainId.Aptos]: {
        disabled: false,
        chainId: ChainId.Aptos,
        name: 'Aptos',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_aptos.svg'),
        blockExplorer: 'https://explorer.aptoslabs.com',
    },
    [ChainId.Sui]: {
        disabled: false,
        chainId: ChainId.Sui,
        name: 'Sui',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_sui.svg'),
        blockExplorer: 'https://suiscan.xyz/testnet',
    },
    [ChainId.Solana]: {
        disabled: false,
        chainId: ChainId.Solana,
        name: 'Solana',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_solana.svg'),
        blockExplorer: 'https://explorer.solana.com',
    },
};

if (process.env.NODE_ENV !== 'production') {
    chainInfo[ChainId.Hardhat] = {
        disabled: false,
        chainId: ChainId.Hardhat,
        name: 'Hardhat',
        logo: require('@thxnetwork/dashboard/../public/assets/thx_logo_hardhat.svg'),
        blockExplorer: 'https://hardhatscan.com',
    };
}

export function getTokenURL(chainId: ChainId, address: string) {
    return `${chainInfo[chainId].blockExplorer}/token/${address}`;
}

export function getAddressURL(chainId: ChainId, address: string) {
    return `${chainInfo[chainId].blockExplorer}/address/${address}`;
}

export { chainInfo };
