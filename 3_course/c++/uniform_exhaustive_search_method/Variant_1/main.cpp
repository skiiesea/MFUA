#include <iostream>
#include <iomanip>
#include <fstream>
#include "functions.h"
#include "plain_methods.h"

int main() {
    const double eps = 0.000001;
    int n;
    double x;

    std::cout << std::fixed << std::setprecision(8);

    std::cout << "Function 9: cos(x)\n";
    x = min_uniform_search(1.5707963, 4.7123890, eps, foo9, n);
    std::cout << "Uniform: " << x << "  iterations: " << n << '\n';
    x = min_local(1.5707963, 4.7123890, eps, foo9, n);
    std::cout << "Localization: " << x << "  iterations: " << n << '\n';
    x = min_dihotomia(1.5707963, 4.7123890, eps, foo9, n);
    std::cout << "Dichotomy: " << x << "  iterations: " << n << '\n';
    x = min_golden_ration(1.5707963, 4.7123890, eps, foo9, n);
    std::cout << "Golden ratio: " << x << "  iterations: " << n << '\n';
    x = min_Fibonacci(1.5707963, 4.7123890, eps, foo9, n);
    std::cout << "Fibonacci: " << x << "  iterations: " << n << "\n\n";

    std::cout << "Function 14: x^5 - 5*x^3\n";
    x = min_uniform_search(-4, 0, eps, foo14, n);
    std::cout << "Uniform: " << x << "  iterations: " << n << '\n';
    x = min_local(-4, 0, eps, foo14, n);
    std::cout << "Localization: " << x << "  iterations: " << n << '\n';
    x = min_dihotomia(-4, 0, eps, foo14, n);
    std::cout << "Dichotomy: " << x << "  iterations: " << n << '\n';
    x = min_golden_ration(-4, 0, eps, foo14, n);
    std::cout << "Golden ratio: " << x << "  iterations: " << n << '\n';
    x = min_Fibonacci(-4, 0, eps, foo14, n);
    std::cout << "Fibonacci: " << x << "  iterations: " << n << "\n\n";

    std::cout << "Function 16: x^6 - 5*x^2\n";
    x = min_uniform_search(-1, 1, eps, foo16, n);
    std::cout << "Uniform: " << x << "  iterations: " << n << '\n';
    x = min_local(-1, 1, eps, foo16, n);
    std::cout << "Localization: " << x << "  iterations: " << n << '\n';
    x = min_dihotomia(-1, 1, eps, foo16, n);
    std::cout << "Dichotomy: " << x << "  iterations: " << n << '\n';
    x = min_golden_ration(-1, 1, eps, foo16, n);
    std::cout << "Golden ratio: " << x << "  iterations: " << n << '\n';
    x = min_Fibonacci(-1, 1, eps, foo16, n);
    std::cout << "Fibonacci: " << x << "  iterations: " << n << "\n\n";

    std::cout << "Function 19: x^3 + 9*x\n";
    x = min_uniform_search(-1, 1, eps, foo19, n);
    std::cout << "Uniform: " << x << "  iterations: " << n << '\n';
    x = min_local(-1, 1, eps, foo19, n);
    std::cout << "Localization: " << x << "  iterations: " << n << '\n';
    x = min_dihotomia(-1, 1, eps, foo19, n);
    std::cout << "Dichotomy: " << x << "  iterations: " << n << '\n';
    x = min_golden_ration(-1, 1, eps, foo19, n);
    std::cout << "Golden ratio: " << x << "  iterations: " << n << '\n';
    x = min_Fibonacci(-1, 1, eps, foo19, n);
    std::cout << "Fibonacci: " << x << "  iterations: " << n << "\n\n";

    std::cout << "Function 27: 6*x^2 - 12*x\n";
    x = min_uniform_search(-4, 0, eps, foo27, n);
    std::cout << "Uniform: " << x << "  iterations: " << n << '\n';
    x = min_local(-4, 0, eps, foo27, n);
    std::cout << "Localization: " << x << "  iterations: " << n << '\n';
    x = min_dihotomia(-4, 0, eps, foo27, n);
    std::cout << "Dichotomy: " << x << "  iterations: " << n << '\n';
    x = min_golden_ration(-4, 0, eps, foo27, n);
    std::cout << "Golden ratio: " << x << "  iterations: " << n << '\n';
    x = min_Fibonacci(-4, 0, eps, foo27, n);
    std::cout << "Fibonacci: " << x << "  iterations: " << n << "\n\n";

    std::cout << "Function 50: (3*x^4 - 12*x)*cos(x)\n";
    x = min_uniform_search(-2, 0, eps, foo50, n);
    std::cout << "Uniform: " << x << "  iterations: " << n << '\n';
    x = min_local(-2, 0, eps, foo50, n);
    std::cout << "Localization: " << x << "  iterations: " << n << '\n';
    x = min_dihotomia(-2, 0, eps, foo50, n);
    std::cout << "Dichotomy: " << x << "  iterations: " << n << '\n';
    x = min_golden_ration(-2, 0, eps, foo50, n);
    std::cout << "Golden ratio: " << x << "  iterations: " << n << '\n';
    x = min_Fibonacci(-2, 0, eps, foo50, n);
    std::cout << "Fibonacci: " << x << "  iterations: " << n << '\n';


    // Сохраняем количество итераций для построения графиков.
    std::ofstream file("iterations.csv");
    file << "function,method,h,iterations\\n";

    double (*funcs[6])(double) = {foo9, foo14, foo16, foo19, foo27, foo50};
    int numbers[6] = {9, 14, 16, 19, 27, 50};
    double left[6] = {2.14159265, -4, -1, -1, -4, -2};
    double right[6] = {4.14159265, -2, 0, 1, 0, -1.2};

    for (int i = 0; i < 6; i++) {
        for (int j = 1; j <= 8; j++) {
            double h = (right[i] - left[i]) * j / 8.0;
            double a = left[i];
            double b = a + h;

            if (numbers[i] == 9) {
                a = 3.14159265 - h / 2.0;
                b = 3.14159265 + h / 2.0;
            }

            min_uniform_search(a, b, 0.01, funcs[i], n);
            file << numbers[i] << ",Uniform," << h << "," << n << '\\n';
            min_local(a, b, 0.01, funcs[i], n);
            file << numbers[i] << ",Localization," << h << "," << n << '\\n';
            min_dihotomia(a, b, 0.01, funcs[i], n);
            file << numbers[i] << ",Dichotomy," << h << "," << n << '\\n';
            min_golden_ration(a, b, 0.01, funcs[i], n);
            file << numbers[i] << ",Golden ratio," << h << "," << n << '\\n';
            min_Fibonacci(a, b, 0.01, funcs[i], n);
            file << numbers[i] << ",Fibonacci," << h << "," << n << '\\n';
        }
    }

    file.close();
    std::cout << "\\nGraph data saved to iterations.csv\\n";

    return 0;
}
