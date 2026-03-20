import { RoomEvent, type MatrixClient, type MatrixEvent, type Room } from 'matrix-js-sdk';
import { useEffect, useRef } from 'react';

interface UseMatrixRoomEventsOptions {
  client: MatrixClient | null;
  enabled: boolean;
  onRoomChange: (room: Room) => void;
}

export function useMatrixRoomEvents({
  client,
  enabled,
  onRoomChange,
}: UseMatrixRoomEventsOptions) {
  const onRoomChangeRef = useRef(onRoomChange);

  useEffect(() => {
    onRoomChangeRef.current = onRoomChange;
  }, [onRoomChange]);

  useEffect(() => {
    if (!client || !enabled) {
      return;
    }

    const emitRoomChange = (room: Room | undefined | null) => {
      if (!room) {
        return;
      }

      onRoomChangeRef.current(room);
    };

    const handleTimeline = (
      _event: MatrixEvent,
      room: Room | undefined,
      _toStartOfTimeline: boolean | undefined,
      _removed: boolean,
      data: { liveEvent?: boolean }
    ) => {
      if (!data.liveEvent) {
        return;
      }

      emitRoomChange(room);
    };

    const handleReceipt = (_event: MatrixEvent, room: Room) => {
      emitRoomChange(room);
    };

    const handleName = (room: Room) => {
      emitRoomChange(room);
    };

    const handleMembership = (room: Room) => {
      emitRoomChange(room);
    };

    const handleAccountData = (_event: MatrixEvent, room: Room) => {
      emitRoomChange(room);
    };

    const handleLocalEchoUpdated = (_event: MatrixEvent, room: Room) => {
      emitRoomChange(room);
    };

    const handleTimelineReset = (room: Room | undefined) => {
      emitRoomChange(room);
    };

    client.on(RoomEvent.Timeline, handleTimeline);
    client.on(RoomEvent.Receipt, handleReceipt);
    client.on(RoomEvent.Name, handleName);
    client.on(RoomEvent.MyMembership, handleMembership);
    client.on(RoomEvent.AccountData, handleAccountData);
    client.on(RoomEvent.LocalEchoUpdated, handleLocalEchoUpdated);
    client.on(RoomEvent.TimelineReset, handleTimelineReset);

    return () => {
      client.off(RoomEvent.Timeline, handleTimeline);
      client.off(RoomEvent.Receipt, handleReceipt);
      client.off(RoomEvent.Name, handleName);
      client.off(RoomEvent.MyMembership, handleMembership);
      client.off(RoomEvent.AccountData, handleAccountData);
      client.off(RoomEvent.LocalEchoUpdated, handleLocalEchoUpdated);
      client.off(RoomEvent.TimelineReset, handleTimelineReset);
    };
  }, [client, enabled]);
}
