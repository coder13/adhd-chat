/// <reference types="jest" />

import { getRoomIcon, getRoomTopic, updateRoomIdentity } from '../identity';

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

  it('reads the trimmed room icon from state', () => {
    expect(
      getRoomIcon({
        currentState: {
          getStateEvents: jest.fn((eventType: string) =>
            eventType === 'com.tandem.identity'
              ? {
                  getContent: () => ({ icon: '  🍎  ' }),
                }
              : null
          ),
        },
      } as never)
    ).toBe('🍎');
  });

  it('updates room name and topic only when values change', async () => {
    const setRoomName = jest.fn();
    const setRoomTopic = jest.fn();
    const sendStateEvent = jest.fn();

    await updateRoomIdentity(
      {
        setRoomName,
        setRoomTopic,
        sendStateEvent,
      } as never,
      {
        roomId: '!topic:example.com',
        name: 'Plans',
        currentState: {
          getStateEvents: jest.fn((eventType: string) =>
            eventType === 'm.room.topic'
              ? {
                  getContent: () => ({ topic: 'Old topic' }),
                }
              : {
                  getContent: () => ({ icon: '🧠' }),
                }
          ),
        },
      } as never,
      {
        name: 'New plans',
        topic: 'Fresh description',
        icon: '🍎',
      }
    );

    expect(setRoomName).toHaveBeenCalledWith('!topic:example.com', 'New plans');
    expect(setRoomTopic).toHaveBeenCalledWith(
      '!topic:example.com',
      'Fresh description'
    );
    expect(sendStateEvent).toHaveBeenCalledWith(
      '!topic:example.com',
      'com.tandem.identity',
      expect.objectContaining({ icon: '🍎' }),
      ''
    );
  });
});
