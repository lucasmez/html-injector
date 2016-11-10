"use strict";

// If any property is added to 'this' change line 79 at selector.js

//properties to add: actions => [{onClose: true, do: doAppend, source: readStream}, {onClose: false, do:prepend, source: "hi"}]

// Helper function
function addAction(actionFn, source, onClose) {
    //TODO check if source is string of stream
    
    var action = {onClose: (onClose || false), do: actionFn, source: source};
    
    if(Array.isArray(this.actions))
        this.actions.push(action);
    else
        this.actions = [action];
    
    return this;
}


//addMethod('append', true, (source, tagName, push) => {

//});

exports.each = function(fn) {
    
};

exports.append = function(obj) {
    return addAction.call(this, append, obj, true);
};

exports.prepend = function(obj) {
    return addAction.call(this, prepend, obj);
};

exports.after = function(obj) {
    //return addAction.call(this, after, true);
};

exports.before = function(obj) {
    return addAction.call(this, before, obj);    
};

exports.html = function(obj) {
};

exports.replaceWith = function(obj) {
    return addAction.call(this, replaceWith, obj);
};



function before(source, tag, push) {
    if((typeof source === "string") || Buffer.isBuffer(source)) {
        push(source);
        push(tag);
        return push(null);
    }

}

function prepend(source, push, doneCb) {
    if((typeof source === "string") || Buffer.isBuffer(source)) {
        push(tag);
        push(source);
        return push(null);
    }
}

function append(source, push, doneCb) {
    
}

function html(source, push, doneCb) {
 
}

function replaceWith(source, push, doneCb) {
 
}