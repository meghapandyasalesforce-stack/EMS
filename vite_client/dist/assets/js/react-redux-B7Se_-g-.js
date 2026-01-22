import{bV as p}from"./react-core-uDLAZYeG.js";var d={exports:{}},m={};/**
 * @license React
 * use-sync-external-store-with-selector.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var W;function D(){if(W)return m;W=1;var f=p();function y(r,u){return r===u&&(r!==0||1/r===1/u)||r!==r&&u!==u}var E=typeof Object.is=="function"?Object.is:y,j=f.useSyncExternalStore,w=f.useRef,z=f.useEffect,M=f.useMemo,_=f.useDebugValue;return m.useSyncExternalStoreWithSelector=function(r,u,v,s,n){var t=w(null);if(t.current===null){var o={hasValue:!1,value:null};t.current=o}else o=t.current;t=M(function(){function S(e){if(!b){if(b=!0,c=e,e=s(e),n!==void 0&&o.hasValue){var i=o.value;if(n(i,e))return l=i}return l=e}if(i=l,E(c,e))return i;var V=s(e);return n!==void 0&&n(i,V)?(c=e,i):(c=e,l=V)}var b=!1,c,l,R=v===void 0?null:v;return[function(){return S(u())},R===null?void 0:function(){return S(R())}]},[u,v,s,n]);var a=j(r,t[0],t[1]);return z(function(){o.hasValue=!0,o.value=a},[a]),_(a),a},m}var h;function O(){return h||(h=1,d.exports=D()),d.exports}var q=O();export{q as w};
