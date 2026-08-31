import assert from "node:assert/strict";
import { test } from "node:test";
import type { Entry } from "../src/db.ts";
import {
  collectFoods,
  lineAt,
  otherLineKeys,
  replaceLine,
  suggestFoods,
  type FoodStat
} from "../src/food.ts";

const entry = (id: string, text: string, at: number): Entry => ({
  id,
  text,
  at,
  updatedAt: at,
  deleted: 0
});

const at = (day: number, h = 12) => new Date(2026, 7, day, h).getTime();
const texts = (list: FoodStat[]) => list.map((f) => f.text);

test("collect: строки записей схлопываются по нормализованному названию", () => {
  const foods = collectFoods([
    entry("1", "Овсянка\nЧай с молоком", at(1)),
    entry("2", "  овсянка  ", at(2)),
    entry("3", "Овсянка   на воде", at(3))
  ]);
  const oat = foods.find((f) => f.key === "овсянка");
  assert.equal(oat?.count, 2);
  assert.equal(oat?.lastAt, at(2));
  // повторы схлопнулись, «овсянка на воде» — отдельная позиция с нормализованными пробелами
  assert.deepEqual(
    foods.map((f) => f.key).sort(),
    ["чай с молоком", "овсянка", "овсянка на воде"].sort()
  );
  assert.equal(foods.find((f) => f.key === "овсянка на воде")?.text, "Овсянка на воде");
});

test("collect: показываем написание из самой свежей записи, удалённые пропускаем", () => {
  const foods = collectFoods([
    entry("1", "гречка", at(1)),
    entry("2", "Гречка", at(3)),
    { ...entry("3", "кефир", at(4)), deleted: 1, text: "" }
  ]);
  assert.deepEqual(texts(foods), ["Гречка"]);
  assert.equal(foods[0].count, 2);
});

test("collect: пустые строки записи не становятся позициями", () => {
  const foods = collectFoods([entry("1", "\n\nсуп\n   \n", at(1))]);
  assert.deepEqual(texts(foods), ["суп"]);
});

test("подсказки: начало названия важнее начала слова, оно важнее вхождения", () => {
  const foods = collectFoods([
    entry("1", "Чай зелёный", at(1)),
    entry("2", "Кофе с чаем", at(2)),
    entry("3", "Печенье к чаю", at(3))
  ]);
  assert.deepEqual(texts(suggestFoods(foods, "ча")), ["Чай зелёный", "Печенье к чаю", "Кофе с чаем"]);
});

test("подсказки: внутри одного уровня совпадения — по частоте, потом по свежести", () => {
  const foods = collectFoods([
    entry("1", "салат овощной", at(1)),
    entry("2", "салат овощной", at(2)),
    entry("3", "салат цезарь", at(5)),
    entry("4", "салат греческий", at(4))
  ]);
  assert.deepEqual(texts(suggestFoods(foods, "салат")), [
    "салат овощной",
    "салат цезарь",
    "салат греческий"
  ]);
});

test("подсказки: регистр и лишние пробелы запроса не важны", () => {
  const foods = collectFoods([entry("1", "Творог 5%", at(1))]);
  assert.deepEqual(texts(suggestFoods(foods, "  ТВОР ")), ["Творог 5%"]);
});

test("подсказки: набранное целиком и уже перечисленное в записи не предлагаем", () => {
  const foods = collectFoods([
    entry("1", "Кефир", at(1)),
    entry("2", "Кефир 1%", at(2))
  ]);
  assert.deepEqual(texts(suggestFoods(foods, "кефир")), ["Кефир 1%"]);
  assert.deepEqual(suggestFoods(foods, "кефир", { exclude: new Set(["кефир 1%"]) }), []);
});

test("подсказки: пустой запрос ничего не предлагает, длинный список обрезается", () => {
  const foods = collectFoods([entry("1", "чай 1\nчай 2\nчай 3\nчай 4\nчай 5\nчай 6\nчай 7", at(1))]);
  assert.deepEqual(suggestFoods(foods, "   "), []);
  assert.equal(suggestFoods(foods, "чай").length, 6);
  assert.equal(suggestFoods(foods, "чай", { limit: 2 }).length, 2);
});

test("строка под курсором: границы, начало текста и перевод строки первым символом", () => {
  const text = "суп\nкаша\nчай";
  assert.deepEqual(lineAt(text, 0), { start: 0, end: 3, value: "суп" });
  assert.deepEqual(lineAt(text, 3), { start: 0, end: 3, value: "суп" });
  assert.deepEqual(lineAt(text, 4), { start: 4, end: 8, value: "каша" });
  assert.deepEqual(lineAt(text, text.length), { start: 9, end: 12, value: "чай" });
  assert.deepEqual(lineAt("\nкаша", 0), { start: 0, end: 0, value: "" });
  // курсор за пределами текста (значение сменилось раньше, чем пришло событие)
  assert.deepEqual(lineAt("суп", 99), { start: 0, end: 3, value: "суп" });
});

test("подстановка: заменяется строка под курсором, курсор встаёт в её конец", () => {
  const r = replaceLine("суп\nкаш\nчай", 7, "каша гречневая");
  assert.equal(r.text, "суп\nкаша гречневая\nчай");
  assert.equal(r.caret, 18);
  assert.equal(r.text.slice(0, r.caret).split("\n").pop(), "каша гречневая");
});

test("прочие строки записи: текущая не считается, пустые пропускаются", () => {
  assert.deepEqual([...otherLineKeys("Суп\n\nкаш\nЧай", 8)], ["суп", "чай"]);
});
