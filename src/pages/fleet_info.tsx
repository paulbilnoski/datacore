import React, { Component } from 'react';
import { Container, Header, Label, Message, Icon, Table, Item, Image } from 'semantic-ui-react';
import { Link } from 'gatsby';

import Layout from '../components/layout';

type FleetInfoPageProps = {};

type FleetInfoPageState = {
	fleet_id?: string;
	fleet_data?: any;
	errorMessage?: string;
	factions?: any;
	events?: any;
};

class FleetInfoPage extends Component<FleetInfoPageProps, FleetInfoPageState> {
	constructor(props: FleetInfoPageProps) {
		super(props);

		this.state = {
			fleet_id: undefined,
			fleet_data: undefined
		};
	}

	componentDidMount() {
		fetch('/structured/factions.json')
			.then(response => response.json())
			.then(factions => {
				this.setState({ factions });
			});

		fetch('/structured/event_instances.json')
			.then(response => response.json())
			.then(events => {
				this.setState({ events: events.sort((a, b) => (a.instance_id > b.instance_id ? -1 : 1)) });
			});

		let urlParams = new URLSearchParams(window.location.search);
		if (urlParams.has('fleetid')) {
			let fleet_id = urlParams.get('fleetid');
			this.setState({ fleet_id });

			fetch('https://datacore.azurewebsites.net/api/fleet_info?fleetid=' + fleet_id)
				.then(response => response.json())
				.then(fleetData => {
					this.setState({ fleet_data: fleetData });
				})
				.catch(err => {
					this.setState({ errorMessage: err });
				});
		}
	}

	render() {
		const { fleet_id, errorMessage, fleet_data, factions, events } = this.state;

		if (fleet_id === undefined || fleet_data === undefined || errorMessage !== undefined) {
			return (
				<Layout>
					<Container style={{ paddingTop: '4em', paddingBottom: '2em' }}>
						<Header as="h4">Fleet information</Header>
						{errorMessage && (
							<Message negative>
								<Message.Header>Unable to load fleet profile</Message.Header>
								<pre>{errorMessage.toString()}</pre>
							</Message>
						)}
						{!errorMessage && (
							<div>
								<Icon loading name="spinner" /> Loading...
							</div>
						)}
						<p>
							Are you looking to share your player profile? Go to the <Link to={`/voyage`}>Player Tools page</Link> to
							upload your player.json and access other useful player tools.
						</p>
					</Container>
				</Layout>
			);
		}

		let imageUrl = 'icons_icon_faction_starfleet.png';
		if (factions && factions[fleet_data.nicon_index]) {
			imageUrl = factions[fleet_data.nicon_index].icon;
		}

		let event1;
		let event2;
		let event3;

		if (events[0].event_name === fleet_data.leaderboard[0].event_name) {
			event1 = events[0];
			event2 = events[1];
			event3 = events[2];
		} else {
			event1 = events.find(ev => ev.event_name === fleet_data.leaderboard[0].event_name);
			event2 = events.find(ev => ev.event_name === fleet_data.leaderboard[1].event_name);
			event3 = events.find(ev => ev.event_name === fleet_data.leaderboard[2].event_name);
		}

		return (
			<Layout>
				<Container style={{ paddingTop: '4em', paddingBottom: '2em' }}>
					<Item.Group>
						<Item>
							<Item.Image size="tiny" src={`/media/assets/${imageUrl}`} />

							<Item.Content>
								<Item.Header>{fleet_data.name}</Item.Header>
								<Item.Meta>
									<Label>Starbase level: {fleet_data.nstarbase_level}</Label>
									<Label>
										Size: {fleet_data.cursize} / {fleet_data.maxsize}
									</Label>
									<Label>Created: {new Date(fleet_data.created).toLocaleDateString()}</Label>
									<Label>
										Enrollment {fleet_data.enrollment} (min level: {fleet_data.nmin_level})
									</Label>
								</Item.Meta>
								<Item.Description>
									<b>Admiral's MOTD:</b> {fleet_data.motd}
								</Item.Description>
							</Item.Content>
						</Item>
					</Item.Group>

					{event1 && <table>
						<tbody>
							<tr>
								<th>
									{' '}
									<Link to={`/event_info?instance_id=${event1.instance_id}`}>
										{fleet_data.leaderboard[0].event_name}
									</Link>
								</th>
								<th>
									{' '}
									<Link to={`/event_info?instance_id=${event2.instance_id}`}>
										{fleet_data.leaderboard[1].event_name}
									</Link>
								</th>
								<th>
									{' '}
									<Link to={`/event_info?instance_id=${event3.instance_id}`}>
										{fleet_data.leaderboard[2].event_name}
									</Link>
								</th>
							</tr>
							<tr>
								<td><Image size="medium" src={`/media/assets/${event1.image}`} /></td>
								<td><Image size="medium" src={`/media/assets/${event2.image}`} /></td>
								<td><Image size="medium" src={`/media/assets/${event3.image}`} /></td>
							</tr>
							<tr>
								<td align="center">Fleet rank: {fleet_data.leaderboard[0].fleet_rank}</td>
								<td align="center">Fleet rank: {fleet_data.leaderboard[1].fleet_rank}</td>
								<td align="center">Fleet rank: {fleet_data.leaderboard[2].fleet_rank}</td>
							</tr>
						</tbody>
					</table>}

					<Header as="h4">Members</Header>

					<Table celled selectable striped collapsing unstackable compact="very">
						<Table.Header>
							<Table.Row>
								<Table.HeaderCell width={3}>Name</Table.HeaderCell>
								<Table.HeaderCell width={1}>Rank</Table.HeaderCell>
								<Table.HeaderCell width={1}>Profile</Table.HeaderCell>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{fleet_data.members.map((member, idx) => (
								<Table.Row key={idx}>
									<Table.Cell>
										<div
											style={{
												display: 'grid',
												gridTemplateColumns: '60px auto',
												gridTemplateAreas: `'icon stats' 'icon description'`,
												gridGap: '1px'
											}}
										>
											<div style={{ gridArea: 'icon' }}>
												<img
													width={48}
													src={`/media/assets/${member.crew_avatar || 'crew_portraits_cm_empty_sm.png'}`}
												/>
											</div>
											<div style={{ gridArea: 'stats' }}>
												<span style={{ fontWeight: 'bolder', fontSize: '1.25em' }}>
													{member.last_update ? (
														<Link to={`/profile?dbid=${member.dbid}`}>{member.display_name}</Link>
													) : (
														<span>{member.display_name}</span>
													)}
												</span>
											</div>
											<div style={{ gridArea: 'description' }}>
												{member.last_update && (
													<Label size="tiny">
														Last profile upload: {new Date(Date.parse(member.last_update)).toLocaleDateString()}
													</Label>
												)}
											</div>
										</div>
									</Table.Cell>
									<Table.Cell>{member.rank}</Table.Cell>
									<Table.Cell>
										{member.last_update
											? `Last profile upload: ${new Date(Date.parse(member.last_update)).toLocaleDateString()}`
											: 'Never'}
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table>
				</Container>
			</Layout>
		);
	}
}

export default FleetInfoPage;
