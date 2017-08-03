import { CardsApiService } from './api/cardsApi.service';
import { GamesApiService } from './api/gamesApi.service';
import { PlayersApiService } from './api/playersApi.service';
import { UtilsService } from './utils/utils.service';
import { WebSocketService } from './websocket/websocket.service';

export
	default angular
		.module('shared', [])
		.service('cardsApi', CardsApiService)
		.service('gamesApi', GamesApiService)
		.service('playersApi', PlayersApiService)
		.service('utils', UtilsService)
		.service('websocket', WebSocketService)
;
