/*jslint node: true */
(function () {
    'use strict';
    var globalOptions = {
            ignoreUndefined: false,
            escape: "general",
            escapeSets: {
                xml: {
                    "<": "&lt;",
                    ">": "&gt;",
                    "&": "&amp;",
                    "\"": "&quot;"
                },
                general: {
                    "\"": "\\\"",
                    "\'": "\\\'"
                }
            }
        },
        deepMergeJson = function (obja, objb) {
            var prop;
            for (prop in objb) {
                if (objb.hasOwnProperty(prop)) {
                    if (typeof (obja[prop]) === 'object' && typeof (objb[prop]) === 'object') {
                        obja[prop] = deepMergeJson(obja[prop], objb[prop]);
                    } else {
                        obja[prop] = objb[prop];
                    }
                }
            }
            return obja;
        },
        setDeepProperty = function (ident, value, obj) {
            var list,
                recurse = function (propList, value, obj) {
                    if (propList.length > 1) {
                        recurse(propList, value, obj[list.shift()]);
                    } else {
                        obj[propList[0]] = value;
                    }
                };

            if (!ident.push && !ident.map) {
                list = ident.split(".").map(function (e) {return e.trim(); });
            } else {
                list = ident;
            }

            recurse(list, value, obj);
            return obj;
        },
        getDeepProperty = function (ident, obj) {
            var ret = null,
                list,
                recurse = function (propList, obj) {
                    var curident;
                    if (propList.length > 1) {
                        if (obj.hasOwnProperty(propList[0])) {
                            recurse(propList, obj[list.shift()]);
                        } else {
                            curident = propList.reduce(function (a, b, i) {
                                return a + (i > 0 ? "." : "") + b;
                            });
                            throw new Error("Invalid proprty, missing expected data \"" + curident + "\" (IDENT: " + ident + ") from data " + JSON.stringify(obj));
                        }
                    } else {
                        if (obj.hasOwnProperty(propList[0])) {
                            ret = obj[propList[0]];
                        } else {
                            throw new Error("Invalid proprty, missing expected data \"" + propList[0] + "\" (IDENT: " + ident + ") from data " + JSON.stringify(obj));
                        }
                    }
                };

            if (!ident.push && !ident.map) {
                list = ident.split(".").map(function (e) {return e.trim(); });
            } else {
                list = ident;
            }

            recurse(list, obj);
            return ret;
        },
        resolveNamespace = function (ident, blockStack) {
            var l = blockStack.length, i, ret = "";
            for (i = 0; i < l; i += 1) {
                ret += blockStack[i] + ".";
            }
            return ret + ident;
        },
        safeDeepMergeJson = function (obja, objb) {
            if (typeof (obja) !== 'object') {
                throw new TypeError("Cannot deep merge with an " + typeof (obja) + ": [Param 1]");
            }
            if (typeof (objb) !== 'object') {
                throw new TypeError("Cannot deep merge with an " + typeof (objb) + ": [Param 2]");
            }

            return deepMergeJson(deepMergeJson({}, obja), objb);
        },
        /**
         * Using this Regex
         * This regular expression will match and split all valid tags for Sideburns, and provides
         * all data needed to appropriately lex each tag
         *
         * Result indexes (from re.exec()):
         * [0] The whole tag that has been matched
         * [1, 9] These are the opening and closing double square brackets, respectively. Always present
         * [2] The Tag modifier. This will either be '/' for a closing tag, '#' for a pre-process directive
         *     or undefined for all other tags. Processing should branch here depending on whether or not this
         *     token is a hash ('#'). Indexes for one branch will be undefined in case of the other branch.
         *
         * == In case of Directive ==
         * [3] The identifier of the directive to set. Always present
         * [4] The value to set the directive. Always present
         *
         * == In case of other tag ==
         * [5] The Block modifier. Will be '*' for arrays, '&' for context and undefined for simple tags
         * [6] The Data modifier. Will be '!' for an escape with the global set, '!([7])' for an escape with a
         *     specified set or undefined for unescaped data
         * [7] If a set has been specified, this will be the name of the set on its own, seperate from the data
         *     modifier. It will otherwise be undefined
         * [8] The identifier for the data or block that the tag represents. Always present
         **/
        captureTags = /(\[\[)(\#|\/)?\s*(?:([a-zA-Z]+[a-zA-Z0-9]*)\s*\:\s*([a-zA-Z]+[a-zA-Z0-9]*)|([\*\&]?)\s*((?:\!(?:\(([a-zA-Z]+[a-zA-Z0-9]*)\))?)?)\s*([a-zA-Z](?:[a-zA-Z0-9]*(?:\.(?=[a-zA-Z]))?)+))\s*(\]\])/,
        Stack = function () {
            var self = this;
            this.length = 0;
            this.push = function (val) {
                self[self.length] = val;
                self.length += 1;
            };
            this.pop = function (val) {
                var ret = null;
                if (self.length > 0) {
                    ret = self[self.length - 1];
                    self[self.length - 1] = null;
                    self.length -= 1;
                }
                return ret;
            };

            this.peek = function () {
                return this.length > 0 ? self[self.length - 1] : null;
            };
            this.contains = function (value, compare) {
                compare = compare || function (a, b) {
                    return a === b;
                };
                var i = this.length;
                while (i--) {
                    if (compare(this[i], value)) {
                        return true;
                    }
                }
                return false;
            };
            return this;
        },
        Node = function (type, val, modifiers) {
            this.ident = type || "N_NULL";
            this.val = val || null;
            this.content = modifiers || {};
            return this;
        },
        Token = function (ident, val, info) {
            this.ident = ident || "T_NULL";
            this.val = val || null;
            this.info = info || {};
            return this;
        },
        tokenise = function (src) {
            var tokens = [],
                last = 0,
                i = 0,
                match = null,
                matcher,
                chunk,
                tok;

            matcher = function () {
                return ((match = captureTags.exec(chunk)) !== null);
            };
            while (i < src.length) {
                chunk = src.substr(i);
                if (matcher()) {
                    if (match.index > 0) {
                        tokens.push(new Token("STRING", match.input.substr(0, match.index)));
                    }
                    tok = new Token("T_NULL", null, {close: false, escape: false, escapeType: null});
                    if (match[2] === '#') {
                        tok.ident = "T_DIRECTIVE";
                        tok.val = {};
                        tok.val[match[3]] = match[4];
                    } else {
                        if (match[2] === '/') {
                            tok.info.close = true;
                        }

                        if (match[5] === "*") {
                            tok.ident = "T_LOOP";
                        } else if (match[5] === "&") {
                            tok.ident = "T_BLOCK";
                        } else {
                            tok.ident = "T_DATA";
                        }

                        if (typeof (match[6]) !== 'undefined' && match[6].charAt(0) === "!") {
                            tok.info.escape = true;
                            if (typeof (match[7]) !== 'undefined') {
                                tok.info.escapeType = match[7];
                            }
                        }
                        tok.val = match[8];
                    }
                    tokens.push(tok);
                    i += match.index + match[0].length;
                } else {
                    tokens.push(new Token("STRING", chunk));
                    i += chunk.length;
                }
            }
            tokens.push(new Token("EOD"));
            return tokens;
        },
        collapseParse = function (tokens) {
            var tokenList,
                i = 0,
                j,
                targetToken,
                targetNode;

            while (i < tokens.length) {
                if (tokens[i].info && tokens[i].info.close) {
                    tokenList = [];
                    targetToken = tokens[i];
                    j = i - 1;

                    while (!(tokens[j].ident === targetToken.ident && tokens[j].val === targetToken.val)) {
                        tokenList.push(tokens[j]);
                        j -= 1;
                        if (j < 0) {
                            throw new Error("Unmatched Closing Tag " + targetNode + " at index " + i);
                        }
                    }

                    if (targetToken.ident === "T_LOOP") {
                        targetNode = new Node("N_LOOP", targetToken.val, tokenList.slice().reverse());
                    } else {
                        targetNode = new Node("N_BLOCK", targetToken.val, tokenList.slice().reverse());
                    }

                    tokens.splice(j, (i - j) + 1, targetNode);
                    i = 0;
                } else {
                    i += 1;
                }
            }
            return tokens;

        },
        unwindNode = function (output, node, index, arr) {
            var innerArr, dataArr, content, i, dataVal;
            switch (node.ident) {
            case "STRING":
                return output + node.val;

            case "T_DATA":
                dataVal = node.val;
                if (arr.loopTag) {
                    if (node.val === arr.loopTag.slice(0, -1)) {
                        dataVal = arr.loopTag + "." + (arr.i).toString();
                    }
                }
                return output + getDeepProperty(dataVal, arr.data);

            case "N_LOOP":
                content = "";

                innerArr = node.content;
                innerArr.data = arr.data;
                innerArr.loopTag = node.val;

                dataArr = getDeepProperty(node.val, arr.data);

                for (i = 0; i < dataArr.length; i += 1) {
                    innerArr.i = i;
                    content += innerArr.reduce(unwindNode, "");
                }

                return output + content;

            case "N_BLOCK":
                innerArr = node.content;
                innerArr.data = getDeepProperty(node.val, arr.data);
                innerArr.loopTag = null;
                return output + innerArr.reduce(unwindNode, "");

            default:
                return output;
            }
        },
        render = function (src, data, options) {
            var nodes = collapseParse(tokenise(src));
            nodes.data = data;
            nodes.loopTag = null;
            nodes.i = null;
            return nodes.reduce(unwindNode, "");
        };

    render.partial = function (src) {
        return function (tokens, data, options) {
            tokens.data = data;
            tokens.loopTag = null;
            tokens.i = null;
            return tokens.reduce(unwindNode, "");
        }.bind(null, collapseParse(tokenise(src)));
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = render;
    } else {
        window.sideburns = render;
    }
}());
