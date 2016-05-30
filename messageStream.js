/********
 * Module to handle a stream of messages
 *******/

const conversationStateStore = require('./conversationStateStore')
  .createFileSystemConversationStateStore();
const Immutable = require('immutable');
const Rx = require('rx');

// one minute timeout, flush to disk
const THREAD_TIMEOUT_IN_MS = 1000 * 10;

const updateActivityLog = (conversationState, message) => {
  return conversationState.update(
    'activityLog', (activityLog) => {
      return activityLog.push(Immutable.fromJS({
        message,
        timeStamp: (new Date()).toString()
      }));
    }
  );
};

const createMessageStreamHandler = () => {
  const messageStream = new Rx.Subject();

  // hashmap of observables that are used to close a group
  const groupCleanupObservables = {};

  messageStream
    .groupByUntil(
      (message) => { return message.facebookId; },
      undefined,
      (durationGroup) => {
        groupCleanupObservables[durationGroup.key] = new Rx.Subject();
        return groupCleanupObservables[durationGroup.key];
      }
    ).subscribe(
      (groupObservable) => {
        // load the state of the conversation
        const facebookId = groupObservable.key;
        const initialStateStream = conversationStateStore.getConversationState(
          facebookId
        )
          .map((conversationState) => {
            return {
              type: 'CONVERSATION_STATE_LOAD',
              conversationState
            };
          });

        const convoReplay = groupObservable.replay();
        convoReplay.connect();

        const conversationWithTimeout = convoReplay
          .map((message) => {
            return {
              type: 'NEXT_MESSAGE',
              text: message.text
            };
          })
          .timeout(
            THREAD_TIMEOUT_IN_MS,
            new Rx.Observable.return({
              type: 'THREAD_TIMEOUT'
            })
          );

        const scanStream = Rx.Observable.concat(
          initialStateStream.take(1),
          conversationWithTimeout
        )
          .scan(
            (state, nextEvent) => {
              var conversationState;
              if (nextEvent.type === 'CONVERSATION_STATE_LOAD') {
                conversationState = updateActivityLog(
                  nextEvent.conversationState, 'Loaded conversation state'
                );

                return {
                  continue: true,
                  conversationState
                };
              } else if (nextEvent.type === 'NEXT_MESSAGE') {
                conversationState = updateActivityLog(
                  state.conversationState, 'Message from user: ' + nextEvent.text
                );

                return {
                  continue: true,
                  conversationState
                };
              } else if (nextEvent.type === 'THREAD_TIMEOUT') {
                conversationState = updateActivityLog(
                  state.conversationState, 'Thread timed out'
                );

                return {
                  continue: false,
                  conversationState
                };
              }
            },
            { continue: true, conversationState: undefined }
          );

          const finishPredicate = (state) => { return state.continue; };

          // we want to include the state where continue is false
          Rx.Observable.merge(
            scanStream.takeWhile(finishPredicate),
            scanStream.skipWhile(finishPredicate).take(1)
          )
          .last()
          .subscribe(
            (state) => {
              const conversationState = updateActivityLog(
                state.conversationState, 'Saving conversation'
              );

              // signal close of this group
              groupCleanupObservables[facebookId].onNext();
              delete groupCleanupObservables[facebookId];

              conversationStateStore.saveConversationState(
                facebookId,
                conversationState
              );
            }
          );
      }
    );

  return {
    processMessage: (message) => {
      // add the new message to the stream
      messageStream.onNext(message);
    }
  };
};

exports.createMessageStreamHandler = createMessageStreamHandler;