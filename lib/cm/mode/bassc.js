(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"), require("../javascript/javascript"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror", "../javascript/javascript"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

CodeMirror.defineMode("bassc", function (config) {
  var jsMode = CodeMirror.getMode(config, "javascript");

  function identifier(stream) {
    return stream.match(/^[a-zA-Z][a-zA-Z0-9]*/);
  }
  
  var defs = {
    AIN: 1, AOUT: 1, PIN: 1, POUT: 1, MIDIIN: 1, MIDIOUT: 1,
  };

  return {
    startState: function () {
      return {
        inString: false,
        stringType: null,
        // inComment: false,
        inPort: false,
        inParams: false,
        braced: 0,
        lhs: true,
        localState: null
      };
    },
    token: function (stream, state) {
      var wasCls = state.wasCls;
      state.wasCls = false;
      var s, m;
      
      //check for state changes
      if (!state.inString && !state.inComment && ((stream.peek() == '"') || (stream.peek() == "'"))) {
        state.stringType = stream.peek();
        stream.next(); // Skip quote
        state.inString = true; // Update state
      }
      // if (!state.inString && !state.inComment && stream.match(/^\/\*/)) {
      //   state.inComment = true;
      // }

      //return state
      if (state.inString) {
        while (state.inString && !stream.eol()) {
          if (stream.peek() === state.stringType) {
            stream.next(); // Skip quote
            state.inString = false; // Clear flag
          } else if (stream.peek() === '\\') {
            stream.next();
            stream.next();
          } else {
            stream.match(/^.[^\\\"\']*/);
          }
        }
        return state.lhs ? "property string" : "string"; // Token style
      } else if (state.inComment) {
        while (state.inComment && !stream.eol()) {
          if (stream.match(/\*\//)) {
            state.inComment = false; // Clear flag
          } else {
            stream.match(/^.[^\*]*/);
          }
        }
        return "comment";
      } else if (stream.peek() === '[') {
        stream.next();
        state.inPort = true;
        return 'bracket';
      } else if (stream.peek() === '<') {
        stream.next();
        state.inParams = true;
        return 'bracket';
      } else if (stream.match(/^#/)) {
        stream.skipToEnd();
        return "comment";
      } else if (stream.match(/^[=-]+>/)) {
        return "keyword";
      } else if (state.braced || (stream.peek() === '{' && !wasCls)) {
        if (state.localState === null) {
          state.localState = jsMode.startState();
        }
        var token = jsMode.token(stream, state.localState);
        var text = stream.current();
        if (!token) {
          for (var i = 0; i < text.length; i++) {
            if (text[i] === '{') {
              state.braced++;
            } else if (text[i] === '}') {
              state.braced--;
            }
          };
        }
        return token;
      } else if (state.inPort && stream.match(/^[0-9]+(-[0-9]+)?/)) {
        return 'property';
      } else if (stream.match(/^[a-z][a-zA-Z0-9]*/)) {
        return state.inPort ? 'property' : 'variable';
      } else if (stream.match(/^_[0-9]+(-[0-9]+)?/)) {
        return 'property';
      } else if (stream.match(/^@[a-zA-Z]+/)) {
        return 'keyword';
      } else if (stream.match(/^-?[0-9]+(\.[0-9]*)?/)) {
        return 'number';
      } else if (stream.match(/^\*/)) {
        return 'builtin';
      } else if (m = stream.match(/^[A-Z][a-zA-Z0-9]*/)) {
        if (defs[m[0]]) return 'def';
        if (state.inParams) return 'atom';
        state.wasCls = true;
        stream.eatSpace();
        return 'variable-2';
      } else if (['[', ']', '(', ')', '<', '>'].indexOf(stream.peek()) != -1) {
        if (stream.peek() === ']') state.inPort = false;
        if (stream.peek() === '>') state.inParams = false;
        stream.next();
        return 'bracket';
      } else if (!stream.eatSpace()) {
        stream.next();
      }
      return null;
    }
  };
}, "javascript");

});
