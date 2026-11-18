import csv
import os
from collections import defaultdict
import matplotlib.pyplot as plt

methods = ["Uniform", "Localization", "Dichotomy", "Golden ratio", "Fibonacci"]
data = defaultdict(lambda: defaultdict(list))

with open("iterations.csv", newline="", encoding="utf-8") as file:
    reader = csv.DictReader(file)
    for row in reader:
        number = int(row["function"])
        method = row["method"]
        data[number][method].append((float(row["h"]), int(row["iterations"])))

os.makedirs("graphs", exist_ok=True)
for number in [9, 14, 16, 19, 27, 50]:
    plt.figure(figsize=(9, 5.5))
    for method in methods:
        points = sorted(data[number][method])
        x = [point[0] for point in points]
        y = [max(point[1], 1) for point in points]
        plt.plot(x, y, marker="o", label=method)

    plt.yscale("log")
    plt.xlabel("Ширина отрезка h")
    plt.ylabel("Количество итераций n (логарифмическая шкала)")
    plt.title(f"Функция №{number}: зависимость числа итераций от ширины отрезка")
    plt.grid(True, which="both", linestyle="--", linewidth=0.5)
    plt.legend()
    plt.tight_layout()
    plt.savefig(f"graphs/function_{number}.png", dpi=160)
    plt.close()
