## Пример решения для варианта 15 (схема Д1.5)

### Шаг 1: Участок AB

Выберем ось $s$ вдоль участка $AB$ (от $A$ к $B$). Второй закон Ньютона:

$$
m \ddot{s} = Q - \mu (\dot{s})^2 - mg \sin \alpha
$$

Разделим на $m$:

$$
\ddot{s} = \frac{Q}{m} - \frac{\mu}{m} (\dot{s})^2 - g \sin \alpha
$$

Обозначим:
- $a = \frac{Q}{m} - g \sin \alpha$
- $b = \frac{\mu}{m}$

Тогда:

$$
\ddot{s} = a - b (\dot{s})^2
$$

Это уравнение можно записать как:

$$
\frac{dv}{dt} = a - b v^2, \quad \text{где } v = \dot{s}
$$

Для нахождения скорости в точке $B$ используем связь между скоростью и пройденным путём:

$$
\frac{dv}{ds} \cdot v = a - b v^2
\quad \Rightarrow \quad
\frac{v dv}{a - b v^2} = ds
$$

Проинтегрируем от $s = 0$ до $s = l$, от $v = v_0$ до $v = v_B$:

$$
\int_{v_0}^{v_B} \frac{v dv}{a - b v^2} = \int_0^l ds = l
$$

Вычислим интеграл. Пусть $u = a - b v^2$, тогда $du = -2b v dv$, следовательно $v dv = -\frac{du}{2b}$:

$$
\int \frac{v dv}{a - b v^2} = -\frac{1}{2b} \int \frac{du}{u} = -\frac{1}{2b} \ln |a - b v^2| + C
$$

Подставляем пределы:

$$
-\frac{1}{2b} \left[ \ln |a - b v_B^2| - \ln |a - b v_0^2| \right] = l
\quad \Rightarrow \quad
\ln \left( \frac{a - b v_B^2}{a - b v_0^2} \right) = -2b l
$$

Отсюда:

$$
a - b v_B^2 = (a - b v_0^2) e^{-2b l}
\quad \Rightarrow \quad
v_B^2 = \frac{a}{b} - \left( \frac{a}{b} - v_0^2 \right) e^{-2b l}
$$

Таким образом, скорость в точке $B$:

$$
v_B = \sqrt{ \frac{a}{b} - \left( \frac{a}{b} - v_0^2 \right) e^{-2b l} }
$$

---

### Шаг 2: Участок BC

На участке $BC$ выбираем систему координат:
- Ось $x$ - вдоль трубы (вниз по наклону).
- Ось $y$ - перпендикулярно трубы (вверх от поверхности).

Уравнения движения:

#### По оси $x$:
На груз действуют:
- составляющая силы тяжести: $mg \sin \alpha$,
- сила трения: $F_{\text{тр}} = -f N = -f mg \cos \alpha$,
- внешняя сила: $F_x = -\frac{1}{t+1}$.

Тогда:

$$
m \ddot{x} = mg \sin \alpha - f mg \cos \alpha + F_x
= mg (\sin \alpha - f \cos \alpha) - \frac{1}{t+1}
$$

Разделим на $m$:

$$
\ddot{x}(t) = g (\sin \alpha - f \cos \alpha) - \frac{1}{m(t+1)}
$$

Обозначим:

$$
k = g (\sin \alpha - f \cos \alpha)
$$

Тогда:

$$
\ddot{x}(t) = k - \frac{1}{m(t+1)}
$$

#### По оси $y$:
Движение происходит строго вдоль трубы → $\ddot{y} = 0$. Следовательно:

$$
N = mg \cos \alpha
$$

---

### Шаг 3: Решение уравнения движения на участке BC

Интегрируем уравнение $\ddot{x}(t)$ дважды.

Начальные условия:
- $x(0) = 0$
- $\dot{x}(0) = v_B$

#### Первый интеграл (скорость):
$$
\dot{x}(t) = v_B + \int_0^t \ddot{x}(\tau) d\tau
= v_B + \int_0^t \left( k - \frac{1}{m(\tau+1)} \right) d\tau
= v_B + k t - \frac{1}{m} \ln(t+1)
$$

#### Второй интеграл (координата):
$$
x(t) = \int_0^t \dot{x}(\tau) d\tau
= \int_0^t \left( v_B + k \tau - \frac{1}{m} \ln(\tau+1) \right) d\tau
$$

Вычислим:

$$
x(t) = v_B t + \frac{k}{2} t^2 - \frac{1}{m} \int_0^t \ln(\tau+1) d\tau
$$

Интеграл $\int_0^t \ln(\tau+1) d\tau$:

Пусть $u = \tau + 1$, тогда:

$$
\int_0^t \ln(\tau+1) d\tau = \int_1^{t+1} \ln u \, du = \left[ u \ln u - u \right]_1^{t+1}
= (t+1)\ln(t+1) - (t+1) - (1 \cdot \ln 1 - 1)
= (t+1)\ln(t+1) - t
$$

Окончательно:

$$
x(t) = v_B t + \frac{k}{2} t^2 - \frac{1}{m} \left[ (t+1)\ln(t+1) - t \right]
$$

---

### Шаг 4: Закон движения на участке BC

Так как движение ограничено трубой и ось $y$ перпендикулярна ей, то $y(t) = 0$ при всех $t$ (если начало координат выбрано в точке $B$).

Таким образом, закон движения груза на участке $BC$:

$$
\boxed{
\begin{aligned}
x(t) &= v_B t + \frac{k}{2} t^2 - \frac{1}{m} \left[ (t+1)\ln(t+1) - t \right] \\
y(t) &= 0
\end{aligned}
}
\quad \text{где} \quad
\begin{aligned}
&k = g (\sin \alpha - f \cos \alpha), \\
&v_B = \sqrt{ \frac{a}{b} - \left( \frac{a}{b} - v_0^2 \right) e^{-2b l} }, \\
&a = \frac{Q}{m} - g \sin \alpha, \quad b = \frac{\mu}{m}
\end{aligned}
$$

---