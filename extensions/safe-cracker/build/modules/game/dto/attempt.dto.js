'use strict';

var classValidator = require('class-validator');

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
function _ts_decorate(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
__name(_ts_decorate, "_ts_decorate");
function _ts_metadata(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
__name(_ts_metadata, "_ts_metadata");
class AttemptDto {
  static {
    __name(this, "AttemptDto");
  }
  password;
}
_ts_decorate([
  classValidator.IsString({
    message: "\u5BC6\u7801\u5FC5\u987B\u662F\u6587\u672C"
  }),
  classValidator.Length(1, 32, {
    message: "\u5BC6\u7801\u957F\u5EA6\u4E0D\u5408\u6CD5"
  }),
  _ts_metadata("design:type", String)
], AttemptDto.prototype, "password", void 0);

exports.AttemptDto = AttemptDto;
//# sourceMappingURL=attempt.dto.js.map
//# sourceMappingURL=attempt.dto.js.map