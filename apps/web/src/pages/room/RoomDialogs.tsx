import { IonActionSheet } from '@ionic/react';
import type { Room } from 'matrix-js-sdk';
import { Button, IdentityEditorModal, Modal, NotificationSettingsPanel, TangentModal } from '../../components';
import { getRoomIcon } from '../../lib/matrix/identity';
import type { TandemPreferences, RoomNotificationMode } from '../../lib/matrix/preferences';
import type { TandemSpaceRoomSummary } from '../../lib/matrix/spaceCatalog';

interface RoomDialogsProps {
  roomId: string;
  roomName: string;
  roomDescription: string | null;
  currentRoom: Room | null;
  actionError: string | null;
  preferences: TandemPreferences;
  resolveRoomNotificationMode: (roomId: string) => string;
  updateRoomNotificationMode: (roomId: string, value: RoomNotificationMode) => Promise<unknown>;
  tangentTopics: TandemSpaceRoomSummary[];
  conversationMenuButtons: Array<Record<string, unknown>>;
  showMenu: boolean;
  setShowMenu: (value: boolean) => void;
  showIdentityModal: boolean;
  setShowIdentityModal: (value: boolean) => void;
  showTopicNotificationModal: boolean;
  setShowTopicNotificationModal: (value: boolean) => void;
  showArchiveConfirm: boolean;
  setShowArchiveConfirm: (value: boolean) => void;
  showLeaveConfirm: boolean;
  setShowLeaveConfirm: (value: boolean) => void;
  showDeleteTopicConfirm: boolean;
  setShowDeleteTopicConfirm: (value: boolean) => void;
  deleteTopicNameInput: string;
  setDeleteTopicNameInput: (value: string) => void;
  deletingTopic: boolean;
  showTangentModal: boolean;
  setShowTangentModal: (value: boolean) => void;
  creatingTangent: boolean;
  tangentError: string | null;
  setTangentError: (value: string | null) => void;
  savingIdentity: boolean;
  onSaveTopicIdentity: (values: { name: string; description: string; icon: string | null }) => Promise<void>;
  onArchiveTopic: () => void;
  onLeaveTopic: () => void;
  onDeleteTopic: () => void;
  onSelectTopic: (topicId: string) => void;
  onCreateTopic: (name: string) => void;
}

function RoomDialogs({
  roomId,
  roomName,
  roomDescription,
  currentRoom,
  actionError,
  preferences,
  resolveRoomNotificationMode,
  updateRoomNotificationMode,
  tangentTopics,
  conversationMenuButtons,
  showMenu,
  setShowMenu,
  showIdentityModal,
  setShowIdentityModal,
  showTopicNotificationModal,
  setShowTopicNotificationModal,
  showArchiveConfirm,
  setShowArchiveConfirm,
  showLeaveConfirm,
  setShowLeaveConfirm,
  showDeleteTopicConfirm,
  setShowDeleteTopicConfirm,
  deleteTopicNameInput,
  setDeleteTopicNameInput,
  deletingTopic,
  showTangentModal,
  setShowTangentModal,
  creatingTangent,
  tangentError,
  setTangentError,
  savingIdentity,
  onSaveTopicIdentity,
  onArchiveTopic,
  onLeaveTopic,
  onDeleteTopic,
  onSelectTopic,
  onCreateTopic,
}: RoomDialogsProps) {
  return (
    <>
      <IonActionSheet
        isOpen={showMenu}
        onDidDismiss={() => setShowMenu(false)}
        header="Topic"
        cssClass="app-action-sheet"
        buttons={conversationMenuButtons}
      />

      <IdentityEditorModal
        isOpen={showIdentityModal}
        onClose={() => setShowIdentityModal(false)}
        title="Edit Topic"
        nameLabel="Topic name"
        descriptionLabel="Description"
        nameValue={roomName}
        descriptionValue={roomDescription}
        iconValue={currentRoom ? getRoomIcon(currentRoom) : null}
        saveLabel="Save topic"
        isSaving={savingIdentity}
        error={actionError}
        onSave={async (values) => {
          await onSaveTopicIdentity(values);
        }}
      />

      <Modal
        isOpen={showTopicNotificationModal}
        onClose={() => setShowTopicNotificationModal(false)}
        title="Topic notifications"
        size="sm"
      >
        <NotificationSettingsPanel
          title={roomName}
          body="Choose whether this topic follows your default, always notifies, or stays muted."
          value={preferences.roomNotificationOverrides[roomId] ?? 'default'}
          options={[
            { label: 'Default', value: 'default' },
            { label: 'All', value: 'all' },
            { label: 'Muted', value: 'mute' },
          ]}
          onChange={(value) => {
            void updateRoomNotificationMode(roomId, value);
          }}
          helper={`Current effective setting: ${resolveRoomNotificationMode(roomId) === 'mute' ? 'Muted' : 'All messages'}.`}
        />
      </Modal>

      <Modal
        isOpen={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        title="Archive topic"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-text-muted">
            Archive <span className="font-medium text-text">{roomName}</span>?
            The topic will stay in your hub, but it will be treated as archived in the app.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={() => setShowArchiveConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onArchiveTopic}>
              Archive topic
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        title="Leave topic"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-text-muted">
            Leave <span className="font-medium text-text">{roomName}</span>? You can rejoin this Tandem topic later from its hub.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={() => setShowLeaveConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onLeaveTopic}>
              Leave topic
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteTopicConfirm}
        onClose={() => {
          if (deletingTopic) {
            return;
          }
          setShowDeleteTopicConfirm(false);
          setDeleteTopicNameInput('');
        }}
        title="Delete topic"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-text-muted">
            Type <span className="font-medium text-text">{roomName}</span> to permanently remove this topic from your hub.
          </p>
          <input
            value={deleteTopicNameInput}
            onChange={(event) => setDeleteTopicNameInput(event.target.value)}
            placeholder={roomName}
            className="w-full rounded-[18px] border border-line bg-white px-4 py-3 text-sm text-text outline-none transition-colors focus:border-accent"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteTopicConfirm(false);
                setDeleteTopicNameInput('');
              }}
              disabled={deletingTopic}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={onDeleteTopic}
              disabled={deletingTopic || deleteTopicNameInput.trim() !== roomName.trim()}
            >
              {deletingTopic ? 'Deleting...' : 'Delete topic'}
            </Button>
          </div>
        </div>
      </Modal>

      <TangentModal
        isOpen={showTangentModal}
        onClose={() => {
          if (!creatingTangent) {
            setShowTangentModal(false);
            setTangentError(null);
          }
        }}
        topics={tangentTopics}
        onSelectTopic={onSelectTopic}
        onCreateTopic={onCreateTopic}
        isSubmitting={creatingTangent}
        error={tangentError}
      />
    </>
  );
}

export default RoomDialogs;
