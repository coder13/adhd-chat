import {
  ClientEvent,
  type MatrixClient,
  type MatrixEvent,
} from 'matrix-js-sdk';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePersistedResource } from './usePersistedResource';
import {
  acceptTandemInvite,
  addTandemRelationship,
  attachTandemAccountDataListener,
  createTandemInvite,
  declineTandemInvite,
  discoverMatrixUser,
  getInviteLinkPayloadFromSearchParams,
  getResolvedTandemRelationships,
  getTandemRelationships,
  inviteFromToDeviceEvent,
  inviteResponseFromToDeviceEvent,
  sendInviteResponseToDevice,
  TANDEM_RELATIONSHIPS_EVENT_TYPE,
  toIncomingInviteFromLinkPayload,
  updateInviteStatus,
  upsertIncomingInvite,
  type TandemDiscoveredUser,
  type TandemInviteRecord,
  type TandemRelationshipRecord,
} from '../lib/matrix/tandem';

type UseTandemState = {
  incomingInvites: TandemInviteRecord[];
  outgoingInvites: TandemInviteRecord[];
  relationships: TandemRelationshipRecord[];
};

function readState(client: MatrixClient | null): UseTandemState {
  if (!client) {
    return { incomingInvites: [], outgoingInvites: [], relationships: [] };
  }

  return getResolvedTandemRelationships(client);
}

export function useTandem(
  client: MatrixClient | null,
  currentUserId: string | null | undefined
) {
  const cacheKey = currentUserId ? `tandem-state:${currentUserId}` : null;
  const {
    data: state,
    error: persistedStateError,
    refresh,
  } = usePersistedResource<UseTandemState>({
    cacheKey,
    enabled: Boolean(client && currentUserId),
    initialValue: {
      incomingInvites: [],
      outgoingInvites: [],
      relationships: [],
    },
    load: async () => readState(client),
  });
  const [error, setError] = useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !currentUserId) {
      return;
    }

    const detachAccountData = attachTandemAccountDataListener(client, refresh);

    const handleToDeviceEvent = async (event: MatrixEvent) => {
      const invite = inviteFromToDeviceEvent(event);
      if (invite && invite.inviteeMatrixId === currentUserId) {
        try {
          await upsertIncomingInvite(client, invite);
        } catch (cause) {
          console.error(cause);
        }
        return;
      }

      const response = inviteResponseFromToDeviceEvent(event);
      if (response && response.inviterMatrixId === currentUserId) {
        try {
          await updateInviteStatus(
            client,
            response.inviteId,
            'outgoing',
            response.status
          );

          if (response.status === 'accepted') {
            await addTandemRelationship(client, {
              inviteId: response.inviteId,
              partnerUserId: response.inviteeMatrixId,
              sharedSpaceId: response.spaceId,
              mainRoomId: response.mainRoomId,
              createdAt: response.updatedAt,
              status: 'active',
            });
          }
        } catch (cause) {
          console.error(cause);
        }
      }
    };

    client.on(ClientEvent.ToDeviceEvent, handleToDeviceEvent);

    return () => {
      detachAccountData();
      client.off(ClientEvent.ToDeviceEvent, handleToDeviceEvent);
    };
  }, [client, currentUserId, refresh]);

  const discoverUser = useCallback(
    async (matrixUserId: string): Promise<TandemDiscoveredUser> => {
      if (!client) {
        throw new Error('Matrix client is not ready.');
      }

      setError(null);
      return discoverMatrixUser(client, matrixUserId);
    },
    [client]
  );

  const sendInvite = useCallback(
    async (params: {
      inviteeMatrixId: string;
      inviteeDisplayName?: string | null;
      message?: string;
    }) => {
      if (!client || !currentUserId) {
        throw new Error('Matrix client is not ready.');
      }

      setError(null);
      return createTandemInvite({
        client,
        inviterMatrixId: currentUserId,
        inviteeMatrixId: params.inviteeMatrixId,
        inviteeDisplayName: params.inviteeDisplayName,
        origin: window.location.origin,
        message: params.message,
      });
    },
    [client, currentUserId]
  );

  const acceptInvite = useCallback(
    async (invite: TandemInviteRecord) => {
      if (!client || !currentUserId) {
        throw new Error('Matrix client is not ready.');
      }

      setBusyInviteId(invite.inviteId);
      setError(null);

      try {
        await acceptTandemInvite(client, invite);
        await sendInviteResponseToDevice(client, {
          inviteId: invite.inviteId,
          inviterMatrixId: invite.inviterMatrixId,
          inviteeMatrixId: currentUserId,
          status: 'accepted',
          updatedAt: new Date().toISOString(),
          spaceId: invite.spaceId,
          mainRoomId: invite.mainRoomId,
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        throw cause;
      } finally {
        setBusyInviteId(null);
      }
    },
    [client, currentUserId]
  );

  const declineInvite = useCallback(
    async (invite: TandemInviteRecord) => {
      if (!client || !currentUserId) {
        throw new Error('Matrix client is not ready.');
      }

      setBusyInviteId(invite.inviteId);
      setError(null);

      try {
        await declineTandemInvite(client, invite);
        await sendInviteResponseToDevice(client, {
          inviteId: invite.inviteId,
          inviterMatrixId: invite.inviterMatrixId,
          inviteeMatrixId: currentUserId,
          status: 'declined',
          updatedAt: new Date().toISOString(),
          spaceId: invite.spaceId,
          mainRoomId: invite.mainRoomId,
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        throw cause;
      } finally {
        setBusyInviteId(null);
      }
    },
    [client, currentUserId]
  );

  const ensureInviteFromLink = useCallback(
    async (searchParams: URLSearchParams) => {
      if (!client || !currentUserId) {
        return null;
      }

      const payload = getInviteLinkPayloadFromSearchParams(searchParams);
      if (!payload || payload.invitee !== currentUserId) {
        return null;
      }

      const existing = getTandemRelationships(client).incomingInvites.find(
        (invite) => invite.inviteId === payload.inviteId
      );
      if (existing) {
        return existing;
      }

      const nextInvite = {
        ...toIncomingInviteFromLinkPayload(payload),
        inviteUrl: window.location.href,
      };
      await upsertIncomingInvite(client, nextInvite);
      return nextInvite;
    },
    [client, currentUserId]
  );

  const activeRelationship = useMemo(
    () => state.relationships[0] ?? null,
    [state.relationships]
  );

  return {
    ...state,
    activeRelationship,
    busyInviteId,
    error: error ?? persistedStateError,
    refresh,
    discoverUser,
    sendInvite,
    acceptInvite,
    declineInvite,
    ensureInviteFromLink,
    tandemEventType: TANDEM_RELATIONSHIPS_EVENT_TYPE,
  };
}
