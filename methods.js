"use strict";

// If any property is added to 'this' change line 79 at selector.js
//properties to add: actions => [{onClose: true, do: doAppend, source: readStream}, {onClose: false, do:prepend, source: "hi"}]

function _addAction(actionFn, source, onClose) {
    //TODO check if source is string of stream
    
    var action = {onClose: (onClose || false), do: actionFn, source: source};
    
    if(Array.isArray(this.actions))
        this.actions.push(action);
    else
        this.actions = [action];
    
    return this;
}

function addMethod(name, onClose, actionFn) {
    if(actionFn === undefined) {
        actionFn = onClose;
        onClose = false;
    }
    
    exports[name] = function(obj) {
        return _addAction.call(this, actionFn, obj, onClose);
    }
}

addMethod('append', true, append);
addMethod('after', true, after);
addMethod('before', before);
addMethod('prepend', prepend);
addMethod('html');
addMethod('replaceWith');
addMethod('remove');
addMethod('attr');

//addMethod('append', null, append);
//addMethod('before', before);
//addMethod('replaceWith', replaceOpen, replaceClose);
//addMethod('html', htmlOpen, htmlClose);
//addMethod('remove', removeOpen, removeClose);

/*
function replaceOpen(source, tag, push) {
    push(null, {replace: true})
}

function replaceClose(source, tag, push) {
    push(source);
    push(null, {replace: false});
}

funcion htmlOpen(source, tag, push) {
    if(source === null) { //get
        push(tag);
        push(null, {buffer: myBuf});
    }
    
    else { //set
        push(tag);
        push(source);
        push(null, {replace: true});
    }
}

function htmlClose(source, tag, push) {
    if(source === null) { //get
        push(tag);
    }
    
    else { //set
        push(tag);
        push(null, {replace: false});
    }
}

function removeOpen(source, tag, push) {
    push(null, {replace: true});
}

function removeClose(source, tag, push) {
    push(null, {replace: false});
}
*/

function before(source, tag, push) {
    if((typeof source === "string") || Buffer.isBuffer(source)) {
        push(source);
        push(tag, true);
        return push(null);
    }

}

function prepend(source, tag, push) {
    if((typeof source === "string") || Buffer.isBuffer(source)) {
        push(tag, true);
        push(source);
        return push(null);
    }
}

function append(source, tag, push) {
    push(source);
    push(tag, true);
    push(null);
}

function after(source, tag, push) {
    push(tag, true);
    push(source);
    push(null);
}
