const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function app() {
  const ctx = vm.createContext({ console, Intl, Date, setTimeout });
  for (const file of ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '20-rules.js', '46-features.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8'), ctx);
  vm.runInContext(`let S = {
    clock:{tz:'Europe/Zurich',maxSeen:0},settings:{weekStart:'mon'},goals:{minutes:60,days:3,cat:'all',building:''},
    stats:{byCat:{esprit:0,corps:0,calme:0,foyer:0,crea:0},days:{},dailyCats:{}},history:[],
    activities:[{id:'read',name:'Lecture',cat:'esprit',min:10,mode:'focus'},{id:'walk',name:'Marche',cat:'corps',min:20,mode:'free'}],
    routineRun:null,active:null
  };`, ctx);
  return { eval: code => vm.runInContext(code, ctx) };
}

test('Objectifs : semaine lundi-dimanche, sans décalage lors du changement d’heure', () => {
  const a = app();
  assert.equal(a.eval("goalWeek('2026-10-25').start"), '2026-10-19');
  assert.equal(a.eval("goalWeek('2026-10-25').end"), '2026-10-25');
  assert.equal(a.eval("goalWeek('2026-10-26').start"), '2026-10-26');
  assert.equal(a.eval("goalWeek('2027-01-01').start"), '2026-12-28');
});

test('Objectifs : seuls les jours de la semaine choisie comptent, repos libre', () => {
  const a = app();
  a.eval("S.stats.days={'2026-10-18':999,'2026-10-19':10,'2026-10-21':20,'2026-10-24':30,'2026-10-26':999}");
  assert.equal(a.eval("goalProgress(S,'2026-10-25').minutes"), 60);
  assert.equal(a.eval("goalProgress(S,'2026-10-25').activeDays"), 3);
  assert.equal(a.eval("goalProgress(S,'2026-10-25').done"), true);
  assert.equal(a.eval("goalProgress(S,'2026-10-25').goal.days"), 3);
});

test('Objectifs : les catégories persistées ne sont pas recomptées depuis le journal', () => {
  const a = app();
  a.eval("S.goals.cat='esprit';S.stats.dailyCats={'2026-10-20':{esprit:45,corps:90}};S.history=[{ok:true,cat:'esprit',day:'2026-10-20',min:20},{ok:true,cat:'esprit',day:'2026-10-21',min:10},{ok:false,cat:'esprit',day:'2026-10-21',min:99}]");
  assert.equal(a.eval("goalProgress(S,'2026-10-25').minutes"), 55);
  assert.equal(a.eval("goalProgress(S,'2026-10-25').activeDays"), 2);
});

test('Routines : ordre, répétition et valeurs figées lors du lancement', () => {
  const a = app();
  a.eval("S.routineRun=makeRoutineRun({id:'morning',name:'Matin',activityIds:['read','walk','read']});S.activities[0].min=90;S.activities[0].name='Autre nom';");
  assert.equal(a.eval('S.routineRun.steps.length'), 3);
  assert.equal(a.eval('S.routineRun.steps[0].name'), 'Lecture');
  assert.equal(a.eval('S.routineRun.steps[0].min'), 10);
  assert.equal(a.eval('S.routineRun.steps[1].mode'), 'free');
  assert.equal(a.eval('S.routineRun.steps[2].activityId'), 'read');
  assert.equal(a.eval("makeRoutineRun({id:'x',name:'x',activityIds:['read','deleted']})"), null);
});

test('Routines : une réussite avance une seule fois et la dernière termine le bilan', () => {
  const a = app();
  a.eval("S.routineRun=makeRoutineRun({id:'r',name:'Matin',activityIds:['read','walk']});let first={routineRunId:S.routineRun.id,routineStep:0,min:10};");
  assert.equal(a.eval('onRoutineSessionComplete(first,10e6)'), true);
  assert.equal(a.eval('onRoutineSessionComplete(first,10e6)'), false);
  assert.equal(a.eval("onRoutineSessionComplete({routineRunId:'other',routineStep:1,min:20},20e6)"), false);
  assert.equal(a.eval('S.routineRun.status'), 'paused');
  assert.equal(a.eval('S.routineRun.minutes'), 10);
  assert.equal(a.eval('onRoutineSessionComplete({routineRunId:S.routineRun.id,routineStep:1,min:20},20e6)'), true);
  assert.equal(a.eval('S.routineRun.status'), 'done');
  assert.equal(a.eval('S.routineRun.completed'), 2);
  assert.equal(a.eval('S.routineRun.minutes'), 30);
  assert.equal(a.eval('S.routineRun.reward'), 30e6);
  assert.ok(a.eval('S.routineRun.finishedAt') > 0);
});

test('Ville : les seuils de niveau partent du déblocage, aucun niveau pour le décor', () => {
  const a = app();
  assert.equal(a.eval("buildingLevel('arbre')"), 0);
  assert.equal(a.eval("buildingLevel('bibliotheque')"), 1);
  a.eval('S.stats.byCat.esprit=120');
  assert.equal(a.eval("buildingLevel('bibliotheque')"), 2);
  assert.equal(a.eval("buildingLevel('observatoire')"), 1);
  a.eval('S.stats.byCat.esprit=420');
  assert.equal(a.eval("buildingLevel('observatoire')"), 2);
  a.eval('S.stats.byCat.esprit=660');
  assert.equal(a.eval("buildingLevel('observatoire')"), 3);
});


test('Objectifs : les efforts interrompus comptent, les séries et niveaux restent indépendants', () => {
  const a = app();
  a.eval("S.stats.days={'2026-10-19':10};S.stats.effort={byCat:{esprit:29},days:{'2026-10-19':10,'2026-10-20':19,'2026-10-21':0.5},dailyCats:{'2026-10-19':{esprit:10},'2026-10-20':{esprit:19},'2026-10-21':{esprit:0.5}}};");
  assert.equal(a.eval("goalProgress(S,'2026-10-25').minutes"), 29.5);
  assert.equal(a.eval("goalProgress(S,'2026-10-25').activeDays"), 2);
  a.eval("S.goals.cat='esprit'");
  assert.equal(a.eval("goalProgress(S,'2026-10-25').minutes"), 29.5);
  assert.equal(a.eval("S.stats.days['2026-10-20']"), undefined);
  assert.equal(a.eval("buildingLevel('bibliotheque')"), 1);
});

test('Routines : une tâche planifiée ne peut pas devenir une activité répétable via une routine', () => {
  const a = app();
  a.eval("S.activities[0].repeat='once'");
  assert.equal(a.eval("makeRoutineRun({id:'x',name:'x',activityIds:['read','walk']})"), null);
  a.eval("S.activities[0].repeat='weekly'");
  assert.equal(a.eval("routineSummary({activityIds:['read','walk']}).scheduled"), true);
});
