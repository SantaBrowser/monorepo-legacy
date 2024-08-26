<template>
    <BaseModalQuestCreate
        label="Cashback Quest"
        @show="onShow"
        @submit="onSubmit"
        :id="id"
        :pool="pool"
        :quest="quest"
        :disabled="isSubmitDisabled"
        :loading="isLoading"
        :error="error"
    >
    </BaseModalQuestCreate>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { QuestVariant } from '@thxnetwork/common/enums';
import BaseModalQuestCreate from '@thxnetwork/dashboard/components/modals/BaseModalQuestCreate.vue';
import BaseDropdownEventType from '@thxnetwork/dashboard/components/dropdowns/BaseDropdownEventType.vue';

@Component({
    components: {
        BaseModalQuestCreate,
        BaseDropdownEventType,
    },
})
export default class ModalQuestCustomCreate extends Vue {
    isLoading = false;
    error = '';
    limit = 0;
    isCopied = false;
    isVisible = true;

    @Prop() id!: string;
    @Prop() pool!: TPool;
    @Prop({ required: false }) quest!: TQuestCustom;

    get isSubmitDisabled() {
        return false;
    }

    onShow() {
        this.limit = this.quest && this.quest.limit ? this.quest.limit : this.limit;
    }

    async onSubmit(payload: TBaseQuest) {
        this.isLoading = true;
        try {
            await this.$store.dispatch(`pools/${this.quest ? 'updateQuest' : 'createQuest'}`, {
                ...this.quest,
                ...payload,
                variant: QuestVariant.CashbackPlaywall,
                limit: this.limit,
            });
            this.$bvModal.hide(this.id);
            this.$emit('submit', { isPublished: payload.isPublished });
            this.isLoading = false;
        } catch (error: any) {
            this.error = error.message;
        } finally {
            this.isLoading = false;
        }
    }
}
</script>
