#include <iostream>
#include <iomanip>
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

    return 0;
}
