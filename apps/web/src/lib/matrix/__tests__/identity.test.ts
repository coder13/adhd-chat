/// <reference types="jest" />

import { getRoomTopic, updateRoomIdentity } from '../identity';

describe('matrix identity helpers', () => {
  it('reads the trimmed room topic from state', () => {
    expect(
      getRoomTopic({
        currentState: {
          getStateEvents: jest.fn(() => ({
            getContent: () => ({ topic: '  Shared plans  ' }),
          })),
        },
      } as never)
    ).toBe('Shared plans');
  });

  it('updates room name and topic only when values change', async () => {
    const setRoomName = jest.fn();
    const setRoomTopic = jest.fn();

    await updateRoomIdentity(
      {
        setRoomName,
        setRoomTopic,
      } as never,
      {
        roomId: '!topic:example.com',
        name: 'Plans',
        currentState: {
          getStateEvents: jest.fn(() => ({
            getContent: () => ({ topic: 'Old topic' }),
          })),
        },
      } as never,
      {
        name: 'New plans',
        topic: 'Fresh description',
      }
    );

    expect(setRoomName).toHaveBeenCalledWith('!topic:example.com', 'New plans');
    expect(setRoomTopic).toHaveBeenCalledWith(
      '!topic:example.com',
      'Fresh description'
    );
  });
});
