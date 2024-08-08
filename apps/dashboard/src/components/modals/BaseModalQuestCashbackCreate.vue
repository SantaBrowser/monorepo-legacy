<template>
    <BaseModalQuestCreate
        variant="Cashback Quest"
        @show="onShow"
        @submit="onSubmit"
        @change-info-links="infoLinks = Object.values($event)"
        @change-title="title = $event"
        @change-date="expiryDate = $event"
        @change-description="description = $event"
        @change-file="file = $event"
        @change-published="isPublished = $event"
        @change-locks="locks = $event"
        :pool="pool"
        :published="isPublished"
        :id="id"
        :error="error"
        :info-links="infoLinks"
        :loading="isLoading"
        :disabled="isSubmitDisabled || !title"
        :quest="reward"
    >
        <template #col-left>
        </template>
    </BaseModalQuestCreate>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { QuestVariant } from '@thxnetwork/common/enums';
import { isValidUrl } from '@thxnetwork/dashboard/utils/url';
import BaseModal from '@thxnetwork/dashboard/components/modals/BaseModal.vue';
import BaseModalQuestCreate from '@thxnetwork/dashboard/components/modals/BaseModalQuestCreate.vue';
import BaseDropdownEventType from '@thxnetwork/dashboard/components/dropdowns/BaseDropdownEventType.vue';

@Component({
    components: {
        BaseModal,
        BaseModalQuestCreate,
        BaseDropdownEventType,
    },
})
export default class ModalQuestCashbackCreate extends Vue {
    isSubmitDisabled = false;
    isLoading = false;
    isVisible = true;
    error = '';
    title = '';
    description = '';
    expiryDate: Date | number | null = null;
    isPublished = false;
    limit = 0;
    isCopied = false;
    infoLinks: TInfoLink[] = [{ label: '', url: '' }];
    file: File | null = null;
    locks: TQuestLock[] = [];

    @Prop() id!: string;
    @Prop() total!: number;
    @Prop() pool!: TPool;
    @Prop({ required: false }) reward!: TQuestCustom;

    onShow() {
        this.isPublished = this.reward ? this.reward.isPublished : this.isPublished;
        this.title = this.reward ? this.reward.title : this.title;
        this.description = this.reward ? this.reward.description : '';
        this.infoLinks = this.reward ? this.reward.infoLinks : this.infoLinks;
        this.limit = this.reward && this.reward.limit ? this.reward.limit : this.limit;
        this.expiryDate = this.reward && this.reward.expiryDate ? this.reward.expiryDate : this.expiryDate;
        this.locks = this.reward ? this.reward.locks : this.locks;
    }

    onSubmit() {
        this.isLoading = true;
        this.$store
            .dispatch(`pools/${this.reward ? 'updateQuest' : 'createQuest'}`, {
                ...this.reward,
                _id: this.reward ? this.reward._id : undefined,
                variant: QuestVariant.CashbackPlaywall,
                page: 1,
                poolId: String(this.pool._id),
                title: this.title,
                description: this.description,
                isPublished: this.isPublished,
                file: this.file,
                index: !this.reward ? this.total : this.reward.index,
            })
            .then(() => {
                this.$bvModal.hide(this.id);
                this.$emit('submit', { isPublished: this.isPublished });
                this.isLoading = false;
            });
    }
}
</script>
