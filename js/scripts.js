'use strict';
/*===============================================================
          preloader
==================================================================*/
$(window).on('load', function () {
   // makes sure that whole site is loaded
   $('#preloader-gif, #preloader').fadeOut(5000, function () {
   });
});

/*===============================================================
          js-voice-notes-app scripts
==================================================================*/
$(function () {
   // test whether the browser has support for SpeechRecognition
   const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

   if (!SpeechRecognition) {
      swal('No Browser Support', 'Try a browser that supports WebSpeech Recognition', 'error');
      $('.app').hide();
      return;
   }

   //**************** variables ****************//
   const recognition = new SpeechRecognition();

   const note_textarea = $('#note-textarea');
   const notes_list = $('#notes-list');
   const start_button = $('#start-record-btn');
   const stop_button = $('#stop-record-btn');
   const save_button = $('#save-record-btn');

   let is_recording = false;
   let note_content = '';

   let is_editing = false;
   let edit_item;
   let edit_id = '';
   let edit_date;
   let edit_content;

   getInitialNoteList();

   if (navigator.storage && navigator.storage.persisted) {
      // always feature detect
      // persisted() - has this been marked as persisted
      // persist() - permissions request
      navigator.storage.persisted().then((wellWasIt) => {
         console.log({wellWasIt});
         navigator.storage.persist().then((allowed) => {
            console.log({allowed});
         });
      });
   }

   /*===============================================================
          SpeechRecognition - recognition
   ==================================================================*/
   /**
    * If recognition.continuous = false, the recording will stop after a few seconds of
    * silence.  When it is true, the silence period can be longer (about 15 seconds).  Thus,
    * allowing SpeechRecognition to continue recording, even when the speaker pauses.
    */
   recognition.continuous = true;
   recognition.lang = 'en-US';

   /**
    * This function is called every time the Speech API captures a line
    */
   recognition.onresult = function (event) {

      /**
       * The event is a SpeechRecognitionEvent object.  It holds all the line captured. Therefore,
       * the current one will suffice.
       */
      let current = event.resultIndex;

      // Get a transcript of what was said.
      let transcript = event.results[current][0].transcript;

      // Add the current transcript to the contents of our Note.
      // There is a weird bug on mobile, where everything is repeated twice.
      // There is no official solution so far, so we have to handle an edge case.
      var mobile_repeat_bug = (current === 1 && transcript === event.results[0][0].transcript);

      if (!mobile_repeat_bug) {
         note_content += transcript;
         note_textarea.val(note_content);

      }
   }; //end of onresult function

   recognition.onstart = function () {
      swal('Speech Recognition Activated', 'Begin speaking into the microphone', 'success');

   }; //end of onstart function

   recognition.onspeechend = function () {
      if (is_recording === true) {
         swal('Speech Recognition Terminated', 'Terminates, when silence for 15 seconds.', 'info');
      }

   }; //end of onspeechend function

   recognition.onerror = function (event) {
      if (event.error === 'no-speech') {
         swal('Terminated', 'No speech detected. Try again!', 'error');
         return;
      }

   }; //end of onerror function

   /*===============================================================
          functions
   ==================================================================*/
   /**
    * @description -
    * @param id
    * @param date
    * @param content
    */
   function addToLocalStorage(id, date, content) {
      const noteItem = {
         id,
         date,
         content
      };
      let localNoteListArr = getLocalStorage();
      localNoteListArr.push(noteItem);
      localStorage.setItem('savedNoteList', JSON.stringify(localNoteListArr));

   } //end of addToLocalStorage function

   /**
    * @description -
    */
   function addNoSavedNotesParagraph() {
      let item = document.createElement('li');
      item.setAttribute('id', 'no-saved-notes');

      let paragraph = document.createElement('p');
      paragraph.setAttribute('class', 'no-saved-notes');

      let text = 'You do not have any saved notes.';
      let para_text = document.createTextNode(text);

      notes_list.append(item);
      paragraph.appendChild(para_text);
      item.appendChild(paragraph);

   } //end of addNoSavedNotesParagraph function

   /**
    * @description -
    */
   function removeNoSavedNotesParagraph() {
      let item_to_remove = $('#no-saved-notes');
      item_to_remove.remove();

   } //end of removeNoSavedNotesParagraph function

   /**
    * @description -
    * @param id
    * @param date
    * @param content
    */
   function createNoteItem(id, date, content) {
      let attr = document.createAttribute('data-id');
      attr.value = id;

      const template = document.querySelector('#template');
      const clone = document.importNode(template.content, true);

      clone.querySelector('.saved-notes-item').setAttributeNode(attr);
      clone.querySelector('.saved-notes-date').textContent = date;
      clone.querySelector('.note-read').onclick = readNoteItem;
      clone.querySelector('.note-edit').onclick = editNoteItem;
      clone.querySelector('.note-delete').onclick = deleteNoteItem;
      clone.querySelector('.saved-notes-content').textContent = content;

      notes_list.append(clone);

   } //end of createNoteItem function

   /**
    * @description -
    * @param event
    */
   function deleteNoteItem(event) {

      if (event.target.classList.contains('fa-trash-alt')) {
         swal({
            title: 'Are you sure?',
            text: 'Once deleted, impossible to recover!',
            icon: 'warning',
            buttons: true,
            dangerMode: true
         }).then((willDelete) => {
            if (willDelete) {
               const noteItem = event.target.parentElement.parentElement.parentElement.parentElement;
               const id = noteItem.dataset.id;

               noteItem.remove();
               removeFromLocalStorage(id);
               setToDefaultSettings();
               handleNoNotesParagraphs();
               swal('Successfully Delete', 'Your note item has been deleted!', {icon: 'success'});

            } else {
               swal('Note Item Saved', 'Your note item is safe!', {icon: 'info'});
               return;
            }
         });
      }
   } //end of deleteNote function

   /**
    * @description -
    */
   function displaySavedNoteItems() {
      let localNoteListArr = getLocalStorage();
      if (localNoteListArr.length > 0) {
         localNoteListArr.forEach(function (noteItem) {
            createNoteItem(noteItem.id, noteItem.date, noteItem.content);
         });
         localStorage.setItem('savedNoteList', JSON.stringify(localNoteListArr));
      }
   } //end of displayNoteItems functions

   function editNoteItem(event) {

      if (event.target.classList.contains('fa-edit')) {

         is_editing = true;
         save_button.text('edit');

         edit_item = event.target.parentElement.parentElement.parentElement.parentElement;
         edit_id = edit_item.dataset.id;
         edit_date = edit_item.children[0].children[0].innerHTML;
         edit_content = edit_item.children[1].children[0].innerHTML;

         note_textarea.val(edit_content).focus();

      }
   } //end of editNoteItem function

   /**
    * @description -
    * @returns {*[]|any}
    */
   function getInitialNoteList() {
      //**************** get the todoList ****************//
      const localNoteList = localStorage.getItem('savedNoteList');

      //*** parse localNoteList to JSON format if not empty ***//
      if (localNoteList) {
         return JSON.parse(localNoteList);
      }

      //**************** localStorage is empty, set it to 'noteList' ****************//
      localStorage.setItem('savedNoteList', []);
      return [];

   } //end of getInitialNoteList function

   /**
    * @description -
    * @returns {any|*[]}
    */
   function getLocalStorage() {
      return localStorage.getItem('savedNoteList') ? JSON.parse(localStorage.getItem('savedNoteList')) : [];

   } //end of getLocalStorage function

   /**
    * @description -
    */
   function handleNoNotesParagraphs() {

      if ($('li').hasClass('saved-notes-item')) {
         removeNoSavedNotesParagraph();

      } else {
         addNoSavedNotesParagraph();

      }
   } //end of handleNoNotesParagraph function

   /**
    * @description -
    * @param event
    */
   function readNoteItem(event) {

      if (event.target.classList.contains('fa-volume-up')) {
         const noteItem = event.target.parentElement.parentElement.parentElement.parentElement;
         const id = noteItem.dataset.id;

         const content = noteItem.children[1].children[0].innerHTML;
         if ('speechSynthesis' in window) {
            swal('Please Wait...', 'SpeechSynthesisUtterance is starting.', {icon: 'info'});

            const synthesis = window.speechSynthesis;

            setTimeout(() => {
               const speech_utter = new SpeechSynthesisUtterance();
               const voices = synthesis.getVoices();

               speech_utter.lang = 'en-US';
               speech_utter.voice = voices[0];
               speech_utter.text = content;
               speech_utter.volume = 1;
               speech_utter.rate = 0.7;
               speech_utter.pitch = 1;

               synthesis.speak(speech_utter);

            }, 3000);

         } else {
            swal('Not Supported In Your Browser!', 'Text-to-speech is not supported.', {icon: 'info'});
            return;

         }

      }
   } //end of readOutLoudNote function

   /**
    * @description -
    * @param id
    */
   function removeFromLocalStorage(id) {
      let localNoteListArr = getLocalStorage();
      localNoteListArr = localNoteListArr.filter(function (noteItem) {
         if (noteItem.id !== id) {
            return noteItem;
         }
      });
      localStorage.setItem('savedNoteList', JSON.stringify(localNoteListArr));

   } //end of removeFromLocalStorage function

   /**
    * @description -
    * @param event
    */
   function saveNoteItem(event) {
      note_content = note_textarea.val().trim();

      if (note_content && !is_recording && !is_editing) {
         const date_time = new Date();
         let date = date_time.toString().slice(0, -29);
         let id = self.crypto.randomUUID() ? self.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

         createNoteItem(id, date, note_content);
         addToLocalStorage(id, date, note_content);
         setToDefaultSettings();
         handleNoNotesParagraphs();

         swal('Success', 'Note Item Successfully Saved', 'success');

      } else if (note_content && is_editing) {

         edit_content = note_content;

         notes_list.text('');
         updateEditToLocalStorage(edit_id, edit_date, edit_content);
         setToDefaultSettings();

         swal('Successfully Edited', 'Your note item was successfully edited!', 'success');
         displaySavedNoteItems();
         handleNoNotesParagraphs();

      } else {
         swal('Invalid Entry', 'Textarea cannot be empty!', 'error');
         return;
      }

   } //end of saveNoteItem function

   /**
    * @description -
    */
   function setToDefaultSettings() {

      setTimeout(() => {
         note_textarea.val('');
         note_content = '';
         is_recording = false;
         is_editing = false;
         edit_id = '';
         edit_date = '';
         save_button.text('save');

      }, 250);

   } //end of setToDefaultSettings function

   /**
    * @description -
    * @param id
    * @param date
    * @param content
    */
   function updateEditToLocalStorage(id, date, content) {
      let localNoteListArr = getLocalStorage();
      localNoteListArr = localNoteListArr.map(function (noteItem) {
         if (noteItem.id === id) {
            noteItem.date = date;
            noteItem.content = content;
         }
         return noteItem;

      });
      localStorage.setItem('savedNoteList', JSON.stringify(localNoteListArr));

   } //end of updateEditToLocalStorage function

   /*===============================================================
          addEventListeners
   ==================================================================*/
   window.addEventListener('DOMContentLoaded', getInitialNoteList);

   note_textarea.on('click', function (event) {
      note_content = $(this).val();
   });

   start_button.on('click', function (event) {

      if (is_recording === false && is_editing === false) {
         if (note_textarea.val().length > 0) {
            note_textarea.val(' ');

         }
         recognition.start();
         is_recording = true;

      } else if (is_recording === true && is_editing === false) {
         swal('Speech Recognition Error', 'Speech Recognition has already started! Stopping...', 'error');
         recognition.stop();
         is_recording = false;
         return;

      } else {
         swal('Speech Recognition Error', 'Speech Recognition is editing! Stopping...', 'error');
         recognition.stop();

         setToDefaultSettings();
         return;
      }
   });

   stop_button.on('click', function (event) {

      if (is_recording === false) {
         swal('Speech Recognition Information', 'Speech Recognition is not recording', 'info');

      } else {
         recognition.stop();
         is_recording = false;

         swal('Speech Recognition Stopped', 'Speech Recognition has safely stopped', 'info');
         return;
      }
   });

   save_button.on('click', saveNoteItem);

   displaySavedNoteItems();
   handleNoNotesParagraphs();

});