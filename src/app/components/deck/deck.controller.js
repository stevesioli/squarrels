export default class DeckController {
	constructor($rootScope, $scope, $log, toastr, _, decksApi, deckStore, gamesApi, playerModel, playersApi, playersStore, websocket) {
		'ngInject';

		this.$rootScope = $rootScope;
		this.$scope = $scope;
		this.$log = $log.getInstance(this.constructor.name);

		this._ = _;
		this.toastr = toastr;

		this.gamesApi = gamesApi;
		this.decksApi = decksApi;
		this.deckStore = deckStore;
		this.playerModel = playerModel;
		this.pModel = playerModel.model;
		this.playersApi = playersApi;
		this.playersStore = playersStore;
		this.ws = websocket;

		this.maxClicks = 4;
		this.tooManyClicks = false;

		// Bindings from <deck> component
		// this.deckId
		// this.game
		// this.type

		this.$log.debug('constructor()', this);
	}

	$onInit() {
		this.isAdmin = this.$scope.$parent.$parent.gameCtrl.isAdmin;

		this.$log.debug('$onInit()', this);
	}

	$onDestroy() {
		this.$log.debug('$onDestroy()', this);
	}

	cardLimit() {
		return this.type === 'main' ? 1 : this.getDeck().cards.length;
	}

	getDeck() {
		return this.deckStore.getById(this.deckId);
	}

	getTotalCards() {
		return this.getDeck().cards.length;
	}

	isDisabled() {
		return this.type === 'main' && !this.canDraw() ||
			this.type === 'discard' && this.tooManyClicks ||
			this.type === 'action' ||
			!this.game.isGameStarted;
	}

	canDiscard(card) {
		let player = this.pModel.player,
			allowDiscard = false,
			totalCards = player.cardsInHand.length,
			type = card.cardType;

		if (player) {
			allowDiscard = player.isActive && this._.isEmpty(this.game.actionCard);

			if (type === 'special' && allowDiscard) {
				allowDiscard = totalCards === 1 ? true : false;

				if (!allowDiscard) {
					this.toastr.error('NOPE!');
				}
			}
		}

		return allowDiscard;
	}

	canHoard() {
		let player = this.pModel.player;

		if (player) {
			return !player.isActive && !this._.isEmpty(this.game.actionCard);
		}

		return false;
	}

	canDraw() {
		let player = this.pModel.player;

		if (player) {
			return player.isActive && this._.isEmpty(this.game.actionCard) && player.isFirstTurn;
		}

		return false;
	}

	collectHoard() {
		let player = this.pModel.player;

		this.$log.info('collectHoard()', this.pModel.player, this.game.actionCard, this);

		if (this.game.actionCard.action === 'hoard') {
			this.ws.send({
				action: 'hoard',
				playerHoard: player
			});
		} else if (!this._.isEmpty(player.cardsInHand)) {
			this.playerModel.getCards()
				.then(res => {
					let cards = res.data,
						highCard = this._.maxBy(cards, (card) => {
							return card.cardType === 'special' ? -1 : card.amount;
						});

					this.$log.debug('highCard ->', highCard);

					if (!this._.isEmpty(highCard)) {
						this.toastr.warning(highCard.name, 'You just lost a card!');

						// FIXME: Only 1 card should be discarded
						this.deckStore.discard(highCard.id, false);
					}
				}, (err) => {
					this.$log.error(err);
				});
		}
	}

	drawCard(adminCard) {
		let player = this.pModel.player;

		this.$log.debug('drawCard()', player, adminCard, this);

		this.deckStore
			.drawCard(false, adminCard)
			.then(cardDrawn => {
				let cardAction = cardDrawn.action,
					cardsMerge = [],
					plData = {
						totalCards: player.totalCards
					};

				this.$log.debug('deckStore:drawCard()', cardDrawn, cardAction, this);

				if (!cardAction) {
					// Player drew a non-"action" card, so add to their hand and update
					cardsMerge = this._.union(player.cardsInHand, [cardDrawn.id]);

					this.$log.debug('cards:union -> ', cardsMerge);

					plData.cardsInHand = cardsMerge;
					plData.totalCards = cardsMerge.length;
				} else {
					this.gamesApi
						.actionCard(this.game.id, cardDrawn.id)
						.then(res => {
							this.$log.debug('gameUpdate:actionCard -> ', res);
						}, err => {
							this.$log.error(err);
						});

					// Don't allow player to draw more than 7 cards
					if (plData.totalCards >= this.playerModel.numDrawCards) {
						plData.isFirstTurn = false;
					}
				}

				this.playersApi
					.update(player.id, plData)
					.then(res => {
						this.$log.debug('playersApi:update()', res, this);
						this.playersStore.update(player.id, { hasDrawnCard: true });
					})
					.catch(err => {
						this.$log.error('This is nuts! Error: ', err);
					});
			})
			.catch(err => {
				this.$log.error(err);
			});

		this.playerModel.resetSelected();
	}

	onClick() {
		this.$log.debug('onClick()', this);

		this.maxClicks--;

		if (this.type === 'main' && this.canDraw()) {
			this.drawCard();
		} else if (this.type === 'discard' && this.canHoard()) {
			this.collectHoard();
		} else {
			if (this.maxClicks >= 0) {
				this.toastr.warning(`${this.maxClicks} clicks LEFT!`, 'STOP THAT');
			} else {
				this.toastr.error('You have been banned from collecting the Hoard!');
				this.tooManyClicks = true;

				// TODO: Disable clicking even when user refreshes page
			}
		}
	}

	onDropComplete(data, event) {
		this.$log.debug('onDropComplete()', data, event, this);

		if (this.canDiscard(data)) {
			this.deckStore.discard(data.id);
		}

		this.playerModel.resetSelected();
	}

	onDropdownClick(e) {
		let $el = angular.element(e.target),
			cardType = $el.attr('data-type'),
			name = $el.attr('data-name');

		this.$log.debug('onDropdownClick()', e, cardType, name, this);

		e.preventDefault();

		this.drawCard({ cardType, name });
	}
}
