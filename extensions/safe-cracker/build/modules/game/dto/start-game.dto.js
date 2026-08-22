'use strict';

var classValidator = require('class-validator');
var contract = require('../../../shared/contract');

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
const MAX_DEVICES = 200;
class StartGameDto {
  static {
    __name(this, "StartGameDto");
  }
  title;
  agentBindingIds;
  promptTemplate;
  passwordMode;
  passwordLength;
  durationMinutes;
  allowDeviceReport;
  allowStudentInput;
  enableStudentView;
  lockStudentEdits;
}
_ts_decorate([
  classValidator.IsString({
    message: "\u6E38\u620F\u6807\u9898\u5FC5\u987B\u662F\u6587\u672C"
  }),
  classValidator.Length(1, 120, {
    message: "\u6E38\u620F\u6807\u9898\u957F\u5EA6\u9700\u5728 1 \u5230 120 \u4E4B\u95F4"
  }),
  classValidator.IsOptional(),
  _ts_metadata("design:type", String)
], StartGameDto.prototype, "title", void 0);
_ts_decorate([
  classValidator.IsArray({
    message: "\u8BF7\u9009\u62E9\u53C2\u4E0E\u6E38\u620F\u7684\u65B9\u7CD6\u732B"
  }),
  classValidator.ArrayNotEmpty({
    message: "\u81F3\u5C11\u8981\u9009\u4E00\u53F0\u65B9\u7CD6\u732B"
  }),
  classValidator.ArrayMaxSize(MAX_DEVICES, {
    message: `\u4E00\u5C40\u6700\u591A ${MAX_DEVICES} \u53F0\u65B9\u7CD6\u732B`
  }),
  classValidator.IsUUID("4", {
    each: true,
    message: "\u65B9\u7CD6\u732B\u6807\u8BC6\u4E0D\u5408\u6CD5"
  }),
  _ts_metadata("design:type", Array)
], StartGameDto.prototype, "agentBindingIds", void 0);
_ts_decorate([
  classValidator.IsString({
    message: "\u63D0\u793A\u8BCD\u6A21\u677F\u5FC5\u987B\u662F\u6587\u672C"
  }),
  classValidator.Length(1, 4e3, {
    message: "\u63D0\u793A\u8BCD\u6A21\u677F\u957F\u5EA6\u9700\u5728 1 \u5230 4000 \u4E4B\u95F4"
  }),
  classValidator.IsOptional(),
  _ts_metadata("design:type", String)
], StartGameDto.prototype, "promptTemplate", void 0);
_ts_decorate([
  classValidator.IsIn(Object.values(contract.PasswordMode), {
    message: "\u5BC6\u7801\u5206\u914D\u65B9\u5F0F\u4E0D\u5408\u6CD5"
  }),
  classValidator.IsOptional(),
  _ts_metadata("design:type", typeof PasswordModeType === "undefined" ? Object : PasswordModeType)
], StartGameDto.prototype, "passwordMode", void 0);
_ts_decorate([
  classValidator.IsInt({
    message: "\u5BC6\u7801\u4F4D\u6570\u5FC5\u987B\u662F\u6574\u6570"
  }),
  classValidator.Min(contract.PASSWORD_LENGTH_RANGE.min, {
    message: `\u5BC6\u7801\u81F3\u5C11 ${contract.PASSWORD_LENGTH_RANGE.min} \u4F4D`
  }),
  classValidator.Max(contract.PASSWORD_LENGTH_RANGE.max, {
    message: `\u5BC6\u7801\u6700\u591A ${contract.PASSWORD_LENGTH_RANGE.max} \u4F4D`
  }),
  classValidator.IsOptional(),
  _ts_metadata("design:type", Number)
], StartGameDto.prototype, "passwordLength", void 0);
_ts_decorate([
  classValidator.IsInt({
    message: "\u6E38\u620F\u65F6\u957F\u5FC5\u987B\u662F\u6574\u6570"
  }),
  classValidator.Min(contract.DURATION_MINUTES_RANGE.min, {
    message: `\u6E38\u620F\u65F6\u957F\u81F3\u5C11 ${contract.DURATION_MINUTES_RANGE.min} \u5206\u949F`
  }),
  classValidator.Max(contract.DURATION_MINUTES_RANGE.max, {
    message: `\u6E38\u620F\u65F6\u957F\u6700\u591A ${contract.DURATION_MINUTES_RANGE.max} \u5206\u949F`
  }),
  classValidator.IsOptional(),
  _ts_metadata("design:type", Number)
], StartGameDto.prototype, "durationMinutes", void 0);
_ts_decorate([
  classValidator.IsBoolean({
    message: "\u300C\u5141\u8BB8\u65B9\u7CD6\u732B\u4E0A\u62A5\u300D\u5FC5\u987B\u662F\u5E03\u5C14\u503C"
  }),
  classValidator.IsOptional(),
  _ts_metadata("design:type", Boolean)
], StartGameDto.prototype, "allowDeviceReport", void 0);
_ts_decorate([
  classValidator.IsBoolean({
    message: "\u300C\u5141\u8BB8\u5B66\u751F\u9875\u9762\u63D0\u4EA4\u300D\u5FC5\u987B\u662F\u5E03\u5C14\u503C"
  }),
  classValidator.IsOptional(),
  _ts_metadata("design:type", Boolean)
], StartGameDto.prototype, "allowStudentInput", void 0);
_ts_decorate([
  classValidator.IsBoolean({
    message: "\u300C\u542F\u7528\u5B66\u751F\u7AEF\u300D\u5FC5\u987B\u662F\u5E03\u5C14\u503C"
  }),
  classValidator.IsOptional(),
  _ts_metadata("design:type", Boolean)
], StartGameDto.prototype, "enableStudentView", void 0);
_ts_decorate([
  classValidator.IsBoolean({
    message: "\u300C\u9501\u5B9A\u5B66\u751F\u8BBE\u7F6E\u300D\u5FC5\u987B\u662F\u5E03\u5C14\u503C"
  }),
  classValidator.IsOptional(),
  _ts_metadata("design:type", Boolean)
], StartGameDto.prototype, "lockStudentEdits", void 0);

exports.StartGameDto = StartGameDto;
