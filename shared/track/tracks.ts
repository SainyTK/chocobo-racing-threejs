import type { TrackId, TrackDefinition } from './types.ts';

// Hand-built browser interpretations of the original course themes. These are not extracted track meshes.
export const TRACKS: Record<TrackId, TrackDefinition> = {
  test: { name: "Cid's Test Track", difficulty: 1, width: 14, wall: true, cliff: false, sky: '#64b7ed', fog: '#a2cbee', ground: '#499348', road: '#686c81', edge: '#f6eded', accent: '#ef6148', surface: 'asphalt', elevation: 0,
    description: 'A fast circuit. Long straights, broad turns, and a technical infield.',
    points: [[-160,155],[0,155],[155,145],[210,85],[205,-70],[130,-140],[10,-145],[-55,-100],[-55,-20],[-100,5],[-150,-30],[-205,-20],[-215,70]] },
  forest: { name: 'Moogle Forest', difficulty: 2, width: 12, wall: false, cliff: false, sky: '#7bcde8', fog: '#92c4a5', ground: '#4b983c', road: '#b89754', edge: '#e8c681', accent: '#dd835e', surface: 'grass', elevation: 3,
    description: 'Woodland bends and grassy shoulders. Keep your wheels on the path.',
    points: [[-150,130],[0,170],[135,125],[190,45],[130,-10],[170,-100],[75,-165],[-30,-110],[-100,-170],[-195,-90],[-160,-5],[-205,60]] },
  gate: { name: 'The Ancient Gate', difficulty: 2, width: 11, wall: true, cliff: false, sky: '#e9c797', fog: '#baa583', ground: '#a89b5b', road: '#b6a477', edge: '#ded0ab', accent: '#9986b8', surface: 'stone', elevation: 5,
    description: 'Stone walls and tight corners through a forgotten city.',
    points: [[-190,130],[-30,140],[165,140],[180,20],[70,10],[75,-70],[180,-85],[165,-165],[-20,-170],[-20,-55],[-110,-55],[-105,-145],[-205,-130],[-200,0]] },
  mines: { name: 'Mythril Mines', difficulty: 3, width: 10.5, wall: true, cliff: false, sky: '#303451', fog: '#51445c', ground: '#514754', road: '#8c7770', edge: '#aaa0a4', accent: '#83deee', surface: 'wood', elevation: 7,
    description: 'A winding mining railway. Brake before the switchbacks.',
    points: [[-160,155],[15,155],[180,125],[190,25],[115,-30],[180,-110],[100,-170],[-10,-105],[-70,-170],[-170,-145],[-145,-45],[-65,-15],[-130,45],[-210,50]] },
  manor: { name: 'The Black Manor', difficulty: 3, width: 11, wall: true, cliff: false, sky: '#252649', fog: '#494463', ground: '#493747', road: '#736277', edge: '#b6a3b4', accent: '#be87d5', surface: 'stone', elevation: 2,
    description: 'Haunted courtyards and narrow corridors beneath the moon.',
    points: [[-160,130],[20,145],[170,130],[175,40],[90,25],[100,-65],[175,-75],[165,-160],[45,-165],[5,-85],[-70,-80],[-75,-165],[-190,-140],[-185,-40],[-100,-10],[-100,65]] },
  gardens: { name: 'Floating Gardens', difficulty: 3, width: 11, wall: false, cliff: true, sky: '#79c4f2', fog: '#d0ddf1', ground: '#99bedd', road: '#b6b2d8', edge: '#eee6fb', accent: '#79ded8', surface: 'stone', elevation: 8,
    description: 'A road above the clouds. There are no walls to save a missed turn.',
    points: [[-170,150],[0,170],[145,120],[170,30],[65,-10],[75,-90],[155,-135],[75,-205],[-35,-130],[-115,-180],[-200,-100],[-135,-30],[-180,40]] },
  gingerbread: { name: 'Gingerbread Land', difficulty: 3, width: 12, wall: false, cliff: false, sky: '#e49ecb', fog: '#eec6cf', ground: '#c5997c', road: '#d7b171', edge: '#fae0cf', accent: '#ed658b', surface: 'candy', elevation: 3,
    description: 'Candy arches and cake tunnels hide a deceptively long circuit.',
    points: [[-210,135],[-30,180],[150,160],[225,75],[145,25],[220,-65],[130,-130],[30,-80],[-20,-180],[-115,-200],[-175,-100],[-105,-25],[-215,0]] },
  volcano: { name: 'Vulcan-O Valley', difficulty: 4, width: 10.5, wall: false, cliff: true, sky: '#803e45', fog: '#b56e53', ground: '#e0602b', road: '#68535b', edge: '#ad8376', accent: '#ffb247', surface: 'stone', elevation: 11,
    description: 'Cliff edges, hairpins, and lava. Save your Dash for the exits.',
    points: [[-200,135],[-40,175],[145,150],[190,60],[80,10],[185,-60],[110,-165],[0,-100],[-65,-190],[-180,-145],[-125,-50],[-210,0]] },
};
export const TRACK_IDS = Object.keys(TRACKS) as TrackId[];
