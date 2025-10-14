<template>
    <BaseModalRewardCreate
        @show="onShow"
        @submit="onSubmit"
        :pool="pool"
        :id="id"
        :reward="reward"
        :error="error"
        :is-loading="isLoading"
    >
        <BaseFormGroup
            label="Coin Amount"
            tooltip="The amount of coins that will be transferred from your campaign Safe to the kana labs perps account."
        >
            <b-form-input v-model="amount" />
        </BaseFormGroup>
    </BaseModalRewardCreate>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { RewardVariant } from '@thxnetwork/common/enums';
import BaseModalRewardCreate from '@thxnetwork/dashboard/components/modals/BaseModalRewardCreate.vue';
import BaseDropdownWebhook from '@thxnetwork/dashboard/components/dropdowns/BaseDropdownWebhook.vue';

@Component({
    components: {
        BaseModalRewardCreate,
        BaseDropdownWebhook,
    },
})
export default class ModalRewardKanaLabsCreate extends Vue {
    isLoading = false;
    error = '';
    amount = '0';

    metadata = '';

    @Prop() id!: string;
    @Prop() pool!: TPool;
    @Prop({ required: false }) reward!: TRewardCustom;

    async onShow() {
        this.amount = this.reward ? this.reward.amount : this.amount;
        this.metadata = this.reward ? this.reward.metadata : this.metadata;
    }

    async onSubmit(payload: TReward) {
        this.isLoading = true;
        try {
            await this.$store.dispatch(`pools/${this.reward ? 'update' : 'create'}Reward`, {
                ...this.reward,
                ...payload,
                variant: RewardVariant.KanaLabs,
                amount: this.amount,
            });
            this.$emit('submit', { isPublished: payload.isPublished });
            this.$bvModal.hide(this.id);
        } catch (error) {
            this.error = (error as Error).toString();
        } finally {
            this.isLoading = false;
        }
    }
}
</script>
