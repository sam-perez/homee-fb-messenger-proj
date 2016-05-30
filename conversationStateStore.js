/********
Provide a module that will store the state of our message bots.
This module returns an object that exposes a simple API (can be
swapped out by a mock for testing purposes):

getConversationState(facebookId): an observable that emits the conversation
state then completes

saveConversationState(facebookId, conversationState): stores the conversation
state in some persistant storage
********/

const fs = require('fs');
const Immutable = require('immutable');
const path = require('path');
const Rx = require('rx');

const createFileSystemConversationStateStore = () => {
  // helpers for interacting with the fs
  // Asynchronously reads the file at the path.
  const readFile = (path, encoding) => {

  	if(encoding === undefined) {
  	    encoding = 'utf-8';
  	}

  	return Rx.Observable.create((observer) => {
  		fs.readFile(path, encoding, (e, file) => {
  			if(e) {
  			    return observer.onError(e);
		    };

  			observer.onNext(file);
  			observer.onCompleted();
  		});
  	});
  };

  // Writes the file to the path.
  // We assume that the path to the file exists
  const writeFile = (path, data) => {
  	return Rx.Observable.create(function(observer){
  		fs.writeFile(path, data, (e) => {
  			if(e) {
			    return observer.onError(e);
  			}

  			observer.onNext();
  			observer.onCompleted();
  		});
  	});
  };

  const getConversationPath = (facebookId) => {
    // place the store next to this file
    return path.join(__dirname, 'conversationStore', facebookId);
  };

  // Version of a conversation state store which persists
  // the conversations to disk

  const getDefaultConversationState = (facebookId) => {
      return Immutable.fromJS({
        facebookId: facebookId,
        answers: [],
        activityLog: [],
      });
  };

  // an internal cache of conversation states.
  // this should be used by default, but it will
  // only contain a value for a facebookId when the
  // data is being persisted to disk
  const cachedConversationStates = {};

  return {
    getConversationState: (facebookId) => {
        if (cachedConversationStates[facebookId] !== undefined) {
          // just return our cached result
          return Rx.Observable.return(
              cachedConversationStates[facebookId]
          );
        } else {
          const conversationFileName = getConversationPath(facebookId);

          const defaultConversationStateObs = Rx.Observable.return(
            getDefaultConversationState(facebookId)
          );

          const fromFileObs = readFile(conversationFileName)
            .retry(3)
            .map((fileData) => {
                return Immutable.fromJS(JSON.parse(fileData));
            });

          // catch both file read and json parse errors
          return Rx.Observable.catch(
            fromFileObs,
            defaultConversationStateObs
          );
        }
      },

      saveConversationState: (facebookId, conversationState) => {
        cachedConversationStates[facebookId] = conversationState;

        const conversationFileName = getConversationPath(facebookId);

        writeFile(
          conversationFileName,
          JSON.stringify(conversationState, null, 2)
        )
          .retry(3)
          .finally(() => {
             // empty the cache
             delete cachedConversationStates[facebookId];
          })
          // subscribe to the observable to kick things off
          .subscribe();
      }
  };
}

exports.createFileSystemConversationStateStore =
    createFileSystemConversationStateStore;