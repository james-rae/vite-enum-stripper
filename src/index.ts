import './css/style.css';

import { FunTimes, MyEnum } from './fun-module';

const givver = new FunTimes();
givver.doWork();

const p = document.getElementById('pee') as HTMLParagraphElement;

const dogs: MyEnum = Math.random() > 0.5 ? MyEnum.NumberEnumItem : MyEnum.StringEnumItem;

if (dogs === MyEnum.NumberEnumItem) {
    p.innerText = 'Numbers are fun';
} else if (dogs === MyEnum.StringEnumItem) {
    p.innerText = 'Strings are fun';
} else {
    p.innerText = 'Impossible fun happened';
}
