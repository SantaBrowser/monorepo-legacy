import { TBaseReward } from './BaseReward';

export type TERC1155Perk = TBaseReward & {
    erc1155Id: string;
    erc1155metadataId: string;
    pointPrice: number;
    image: string;
    isPromoted: boolean;
};
