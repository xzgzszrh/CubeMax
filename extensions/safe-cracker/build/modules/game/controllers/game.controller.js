'use strict';

var base = require('@buildingai/base');
var decorators = require('@buildingai/core/decorators');
var playground_decorator = require('@buildingai/decorators/playground.decorator');
var errors = require('@buildingai/errors');
var paramValidate_pipe = require('@buildingai/pipe/param-validate.pipe');
var common = require('@nestjs/common');
var dto = require('../dto');
var game_service = require('../services/game.service');

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
function _ts_param(paramIndex, decorator) {
  return function(target, key) {
    decorator(target, key, paramIndex);
  };
}
__name(_ts_param, "_ts_param");
class GameController extends base.BaseController {
  static {
    __name(this, "GameController");
  }
  gameService;
  constructor(gameService) {
    super(), this.gameService = gameService;
  }
  /** 游戏以班级为单位，个人空间下没有学生也没有大屏，直接挡掉。 */
  requireOrganization(organizationId) {
    if (!organizationId) {
      throw errors.HttpErrorFactory.badRequest("\u8BF7\u5148\u5207\u6362\u5230\u73ED\u7EA7\u5DE5\u4F5C\u7A7A\u95F4\u518D\u73A9\u7834\u89E3\u4FDD\u9669\u7BB1");
    }
    return organizationId;
  }
  // ==================== 老师侧 ====================
  listDevices(user, organizationId) {
    return this.gameService.listDevices(user.id, this.requireOrganization(organizationId));
  }
  getCurrent(user, organizationId) {
    return this.gameService.getCurrent(user.id, this.requireOrganization(organizationId));
  }
  startGame(user, dto, organizationId) {
    return this.gameService.startGame(user.id, this.requireOrganization(organizationId), dto);
  }
  endGame(user, id, organizationId) {
    return this.gameService.endGame(user.id, this.requireOrganization(organizationId), id);
  }
  // ==================== 学生侧 ====================
  getMine(user, organizationId) {
    return this.gameService.getStudentView(user.id, this.requireOrganization(organizationId));
  }
  attempt(user, dto, organizationId) {
    return this.gameService.submitStudentAttempt(user.id, this.requireOrganization(organizationId), dto.password);
  }
  // ==================== 大屏侧 ====================
  getBoard(organizationId) {
    return this.gameService.getBoard(this.requireOrganization(organizationId));
  }
}
_ts_decorate([
  common.Get("devices"),
  _ts_param(0, playground_decorator.Playground()),
  _ts_param(1, common.Headers("x-organization-id")),
  _ts_metadata("design:type", Function),
  _ts_metadata("design:paramtypes", [
    typeof UserPlayground === "undefined" ? Object : UserPlayground,
    String
  ]),
  _ts_metadata("design:returntype", void 0)
], GameController.prototype, "listDevices", null);
_ts_decorate([
  common.Get("current"),
  _ts_param(0, playground_decorator.Playground()),
  _ts_param(1, common.Headers("x-organization-id")),
  _ts_metadata("design:type", Function),
  _ts_metadata("design:paramtypes", [
    typeof UserPlayground === "undefined" ? Object : UserPlayground,
    String
  ]),
  _ts_metadata("design:returntype", void 0)
], GameController.prototype, "getCurrent", null);
_ts_decorate([
  common.Post(),
  _ts_param(0, playground_decorator.Playground()),
  _ts_param(1, common.Body()),
  _ts_param(2, common.Headers("x-organization-id")),
  _ts_metadata("design:type", Function),
  _ts_metadata("design:paramtypes", [
    typeof UserPlayground === "undefined" ? Object : UserPlayground,
    typeof dto.StartGameDto === "undefined" ? Object : dto.StartGameDto,
    String
  ]),
  _ts_metadata("design:returntype", void 0)
], GameController.prototype, "startGame", null);
_ts_decorate([
  common.Post(":id/end"),
  _ts_param(0, playground_decorator.Playground()),
  _ts_param(1, common.Param("id", paramValidate_pipe.UUIDValidationPipe)),
  _ts_param(2, common.Headers("x-organization-id")),
  _ts_metadata("design:type", Function),
  _ts_metadata("design:paramtypes", [
    typeof UserPlayground === "undefined" ? Object : UserPlayground,
    String,
    String
  ]),
  _ts_metadata("design:returntype", void 0)
], GameController.prototype, "endGame", null);
_ts_decorate([
  common.Get("mine"),
  _ts_param(0, playground_decorator.Playground()),
  _ts_param(1, common.Headers("x-organization-id")),
  _ts_metadata("design:type", Function),
  _ts_metadata("design:paramtypes", [
    typeof UserPlayground === "undefined" ? Object : UserPlayground,
    String
  ]),
  _ts_metadata("design:returntype", void 0)
], GameController.prototype, "getMine", null);
_ts_decorate([
  common.Post("mine/attempt"),
  _ts_param(0, playground_decorator.Playground()),
  _ts_param(1, common.Body()),
  _ts_param(2, common.Headers("x-organization-id")),
  _ts_metadata("design:type", Function),
  _ts_metadata("design:paramtypes", [
    typeof UserPlayground === "undefined" ? Object : UserPlayground,
    typeof dto.AttemptDto === "undefined" ? Object : dto.AttemptDto,
    String
  ]),
  _ts_metadata("design:returntype", void 0)
], GameController.prototype, "attempt", null);
_ts_decorate([
  common.Get("board"),
  _ts_param(0, common.Headers("x-organization-id")),
  _ts_metadata("design:type", Function),
  _ts_metadata("design:paramtypes", [
    String
  ]),
  _ts_metadata("design:returntype", void 0)
], GameController.prototype, "getBoard", null);
GameController = _ts_decorate([
  decorators.ExtensionWebController("game"),
  _ts_metadata("design:type", Function),
  _ts_metadata("design:paramtypes", [
    typeof game_service.GameService === "undefined" ? Object : game_service.GameService
  ])
], GameController);

exports.GameController = GameController;
