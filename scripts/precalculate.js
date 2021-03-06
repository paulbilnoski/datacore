const fs = require('fs');
const showdown = require('showdown');

const STATIC_PATH = `${__dirname}/../static/structured/`;

let crewlist = JSON.parse(fs.readFileSync(STATIC_PATH + 'crew.json'));
let items = JSON.parse(fs.readFileSync(STATIC_PATH + 'items.json'));

const SKILLS = {
	command_skill: 'CMD',
	science_skill: 'SCI',
	security_skill: 'SEC',
	engineering_skill: 'ENG',
	diplomacy_skill: 'DIP',
	medicine_skill: 'MED'
};

const STARBASE_BONUS_CORE = 1.15;
const STARBASE_BONUS_RANGE = 1.13;
const THIRD_SKILL_MULTIPLIER = 0.25;
const RNGESUS = 1.8; // Used for chron cost calculation

// TODO: this function is duplicated with equiment.ts (find a way to share code between site and scripts)
function calculateCrewDemands(crew, items) {
	let craftCost = 0;
	let demands = [];
	let dupeChecker = new Set();
	crew.equipment_slots.forEach(es => {
		let equipment = items.find(item => item.symbol === es.symbol);
		if (!equipment.recipe) {
			return;
		}

		for (let iter of equipment.recipe.list) {
			let recipeEquipment = items.find(item => item.symbol === iter.symbol);
			if (dupeChecker.has(iter.symbol)) {
				demands.find(d => d.symbol === iter.symbol).count += iter.count;
				continue;
			}

			if (recipeEquipment.item_sources.length === 0) {
				console.error(`Oops: equipment with no recipe and no sources: `, recipeEquipment);
			}

			dupeChecker.add(iter.symbol);

			demands.push({
				count: iter.count,
				symbol: iter.symbol,
				equipment: recipeEquipment,
				factionOnly: iter.factionOnly
			});
		}

		craftCost += equipment.recipe.craftCost;
	});

	const reducer = (accumulator, currentValue) => accumulator + currentValue.count;

	const estimateChronitonCost = equipment => {
		let sources = equipment.item_sources.filter(e => e.type === 0 || e.type === 2);

		// If faction only
		if (sources.length === 0) {
			return 0;
		}

		let costCalc = [];
		for (let source of sources) {
			if (!source.cost) {
				//console.log("Mission information not available!", source);
				continue;
			}

			if (source.avg_cost) {
				costCalc.push(source.avg_cost);
			} else {
				costCalc.push((6 - source.chance_grade) * RNGESUS * source.cost);
			}
		}

		if (costCalc.length === 0) {
			console.warn('Couldnt calculate cost for equipment', equipment);
			return 0;
		}

		return costCalc.sort()[0];
	};

	return {
		craftCost,
		demands,
		factionOnlyTotal: demands.filter(d => d.factionOnly).reduce(reducer, 0),
		totalChronCost: Math.floor(demands.reduce((a, c) => a + estimateChronitonCost(c.equipment), 0))
	};
}

function calcRank(scoring, field) {
	crewlist
		.map(crew => ({ crew, score: scoring(crew) }))
		.sort((a, b) => b.score - a.score)
		.forEach((entry, idx) => {
			if (entry.score && entry.score > 0) {
				entry.crew.ranks[field] = idx + 1;
			}
		});
}

function getCrewMarkDown(crewSymbol) {
	if (!fs.existsSync(`${STATIC_PATH}/../crew/${crewSymbol}.md`)) {
		console.log(`Crew ${crew.name} not found!`);
		return undefined;
	} else {
		const converter = new showdown.Converter({ metadata: true });
		let markdownContent = fs.readFileSync(`${STATIC_PATH}/../crew/${crewSymbol}.md`, 'utf8');
		converter.makeHtml(markdownContent);
		let meta = converter.getMetadata();

		markdownContent = markdownContent.substr(markdownContent.indexOf('---', 4) + 4).trim();

		return {meta, markdownContent};
	}
}

function main() {
	for (let crew of crewlist) {
		let demands = calculateCrewDemands(crew, items);
		crew.totalChronCost = demands.totalChronCost;
		crew.factionOnlyTotal = demands.factionOnlyTotal;
		crew.craftCost = demands.craftCost;

		crew.ranks = {};
	}

	calcRank(crew => {
		let voyTotal = 0;
		for (let skill in SKILLS) {
			if (crew.base_skills[skill]) {
				let voyScore =
					crew.base_skills[skill].core * STARBASE_BONUS_CORE +
					((crew.base_skills[skill].range_max + crew.base_skills[skill].range_min) / 2) * STARBASE_BONUS_RANGE;
				voyTotal += voyScore;
			}
		}

		return Math.ceil(voyTotal);
	}, 'voyRank');

	calcRank(crew => {
		let gauntletTotal = 0;
		for (let skill in SKILLS) {
			if (crew.base_skills[skill]) {
				let gauntletScore = ((crew.base_skills[skill].range_max + crew.base_skills[skill].range_min) * STARBASE_BONUS_RANGE) / 2;
				gauntletTotal += gauntletScore;
			}
		}

		return Math.ceil(gauntletTotal);
	}, 'gauntletRank');

	calcRank(crew => {
		return crew.totalChronCost + crew.factionOnlyTotal * 30;
	}, 'chronCostRank');

	let skillNames = [];
	for (let skill in SKILLS) {
		skillNames.push(skill);

		calcRank(crew => {
			if (crew.base_skills[skill]) {
				return Math.ceil(crew.base_skills[skill].core * STARBASE_BONUS_CORE);
			}

			return 0;
		}, `B_${SKILLS[skill]}`);

		calcRank(crew => {
			if (crew.base_skills[skill]) {
				return Math.ceil(
					crew.base_skills[skill].core * STARBASE_BONUS_CORE +
						((crew.base_skills[skill].range_max + crew.base_skills[skill].range_min) * STARBASE_BONUS_RANGE) / 2
				);
			}

			return 0;
		}, `A_${SKILLS[skill]}`);
	}

	for (let i = 0; i < skillNames.length - 1; i++) {
		for (let j = i + 1; j < skillNames.length; j++) {
			calcRank(crew => {
				let vTotal = 0;
				let vTertiary = 0;
				for (let skill in SKILLS) {
					if (crew.base_skills[skill]) {
						let vScore =
							crew.base_skills[skill].core * STARBASE_BONUS_CORE +
							((crew.base_skills[skill].range_max + crew.base_skills[skill].range_min) / 2) * STARBASE_BONUS_RANGE;

						if (skill === skillNames[i] || skill === skillNames[j]) {
							vTotal += vScore;
						} else {
							vTertiary += vScore;
						}
					}
				}

				return Math.ceil(vTotal + vTertiary * THIRD_SKILL_MULTIPLIER);
			}, `V_${SKILLS[skillNames[i]]}_${SKILLS[skillNames[j]]}`);

			calcRank(crew => {
				let vTotal = 0;
				let vTertiary = 0;
				for (let skill in SKILLS) {
					if (crew.base_skills[skill]) {
						let vScore = ((crew.base_skills[skill].range_max + crew.base_skills[skill].range_min) / 2) * STARBASE_BONUS_RANGE;

						if (skill === skillNames[i] || skill === skillNames[j]) {
							vTotal += vScore;
						} else {
							vTertiary += vScore;
						}
					}
				}

				//return Math.ceil(vTotal + vTertiary * THIRD_SKILL_MULTIPLIER);
				return Math.ceil(vTotal);
			}, `G_${SKILLS[skillNames[i]]}_${SKILLS[skillNames[j]]}`);
		}
	}

	fs.writeFileSync(STATIC_PATH + 'crew.json', JSON.stringify(crewlist));

	// Calculate some skill set stats for the BigBook
	let counts = {};
	for (let crew of crewlist) {
		if ((crew.max_rarity === 4 || crew.max_rarity === 5) && Object.getOwnPropertyNames(crew.base_skills).length === 3) {
			let combo = Object.getOwnPropertyNames(crew.base_skills)
				.map(s => SKILLS[s])
				.sort()
				.join('.');

			counts[combo] = 1 + (counts[combo] || 0);
		}
	}

	let sortedSkillSets = Object.keys(counts)
		.map(k => ({ name: k, value: counts[k] }))
		.sort((a, b) => a.value - b.value);

	fs.writeFileSync(STATIC_PATH + 'sortedSkillSets.json', JSON.stringify(sortedSkillSets));

	// Static outputs (TODO: maybe these should be JSON too?)

	let csvOutput = 'crew, tier, rarity, ';

	for (let skill in SKILLS) {
		csvOutput += `${SKILLS[skill]}_core, ${SKILLS[skill]}_min, ${SKILLS[skill]}_max, `;
	}

	for (let i = 0; i < skillNames.length - 1; i++) {
		for (let j = i + 1; j < skillNames.length; j++) {
			csvOutput += `V_${SKILLS[skillNames[i]]}_${SKILLS[skillNames[j]]}, `;
		}
	}

	for (let i = 0; i < skillNames.length - 1; i++) {
		for (let j = i + 1; j < skillNames.length; j++) {
			csvOutput += `G_${SKILLS[skillNames[i]]}_${SKILLS[skillNames[j]]}, `;
		}
	}

	csvOutput += 'traits, hidden_traits, action_name, action_bonus_type, action_bonus_amount, action_initial_cooldown, action_duration, action_cooldown, bonus_ability, trigger, uses_per_battle, penalty_type, penalty_amount, accuracy, crit_bonus, crit_chance, evasion, charge_phases, short_name\r\n';

	for (let crew of crewlist) {
		let crewLine = `"${crew.name.replace(/"/g, '')}",`;

		let mdData = getCrewMarkDown(crew.symbol);
		if (mdData && mdData.meta && mdData.meta.bigbook_tier && (mdData.meta.bigbook_tier < 20)) {
			crewLine += `${mdData.meta.bigbook_tier},`;
		} else {
			crewLine += '0,';
		}

		crewLine += `${crew.max_rarity}, `;

		for (let skill in SKILLS) {
			if (crew.base_skills[skill]) {
				crewLine += `${crew.base_skills[skill].core},${crew.base_skills[skill].range_min},${crew.base_skills[skill].range_max},`;
			} else {
				crewLine += '0,0,0,';
			}
		}

		for (let i = 0; i < skillNames.length - 1; i++) {
			for (let j = i + 1; j < skillNames.length; j++) {
				crewLine += crew.ranks[`V_${SKILLS[skillNames[i]]}_${SKILLS[skillNames[j]]}`] + ',';
			}
		}

		for (let i = 0; i < skillNames.length - 1; i++) {
			for (let j = i + 1; j < skillNames.length; j++) {
				crewLine += crew.ranks[`G_${SKILLS[skillNames[i]]}_${SKILLS[skillNames[j]]}`] + ',';
			}
		}

		crewLine += `"${crew.traits_named.join(', ').replace(/"/g, '')}", "${crew.traits_hidden.join(', ').replace(/"/g, '')}", `;
		crewLine += `"${crew.action.name}", ${crew.action.bonus_type}, ${crew.action.bonus_amount}, ${crew.action.initial_cooldown}, ${crew.action.duration}, ${crew.action.cooldown}, `;
		crewLine += `${crew.action.ability ? crew.action.ability.type : ''}, ${crew.action.ability ? crew.action.ability.condition : ''}, `;
		crewLine += `${crew.action.limit || ''}, ${crew.action.penalty ? crew.action.penalty.type : ''}, ${crew.action.penalty ? crew.action.penalty.amount : ''}, `;
		crewLine += `${crew.ship_battle.accuracy || ''}, ${crew.ship_battle.crit_bonus || ''}, ${crew.ship_battle.crit_chance || ''}, ${crew.ship_battle.evasion || ''}, ${!!crew.action.charge_phases}, `;
		crewLine += `"${crew.short_name}"`;

		crewLine = crewLine.replace(/undefined/g, '0');

		csvOutput += `${crewLine}\r\n`;
	}

	fs.writeFileSync(STATIC_PATH + 'crew.csv', csvOutput);
}

function updateBotStats() {
	let crewlist = JSON.parse(fs.readFileSync(STATIC_PATH + 'crew.json', 'utf8'));

	let botData = [];
	for (let crew of crewlist) {
		let mdData = getCrewMarkDown(crew.symbol);
		if (!mdData) {
			console.log(`Crew ${crew.name} not found!`);
		} else {
			let botCrew = {
				name: crew.name,
				short_name: crew.short_name,
				traits_named: crew.traits_named,
				traits_hidden: crew.traits_hidden,
				imageUrlPortrait: crew.imageUrlPortrait,
				collections: crew.collections,
				totalChronCost: crew.totalChronCost,
				factionOnlyTotal: crew.factionOnlyTotal,
				craftCost: crew.craftCost,
				symbol: crew.symbol,
				max_rarity: crew.max_rarity,
				bigbook_tier: mdData.meta.bigbook_tier,
				events: mdData.meta.events,
				ranks: crew.ranks,
				base_skills: crew.base_skills,
				skill_data: crew.skill_data,
				in_portal: !!mdData.meta.in_portal,
				markdownContent: mdData.markdownContent
			};

			botData.push(botCrew);
		}
	}

	fs.writeFileSync(STATIC_PATH + 'botcrew.json', JSON.stringify(botData));

	if (fs.existsSync(`${__dirname}/../../datacore-bot/data/botcrew.json`)) {
		fs.writeFileSync(`${__dirname}/../../datacore-bot/data/botcrew.json`, JSON.stringify(botData));
	}
}

main();
updateBotStats();
