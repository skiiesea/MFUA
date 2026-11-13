#include <iostream>
#include <iomanip>
#include "functions.h"
#include "plain_methods.h"

int main() {
    std::cout << std::fixed << std::setprecision(8);

    std::cout << "Uniform search:\n";
    double x1_min = min_uniform_search(0.0, 1.0, 1e-6, foo1);
    double x2_min = min_uniform_search(0.0, 6.0, 1e-6, foo2);
    double x3_min = min_uniform_search(0.0, 3.0, 1e-6, foo3);
    std::cout << "foo1: x = " << x1_min << " f(x) = " << foo1(x1_min) << '\n';
    std::cout << "foo2: x = " << x2_min << " f(x) = " << foo2(x2_min) << '\n';
    std::cout << "foo3: x = " << x3_min << " f(x) = " << foo3(x3_min) << '\n';

    std::cout << "Localization:\n";
    x1_min = min_local(0.0, 1.0, 1e-6, foo1);
    x2_min = min_local(0.0, 6.0, 1e-6, foo2);
    x3_min = min_local(0.0, 3.0, 1e-6, foo3);
    std::cout << "foo1: x = " << x1_min << " f(x) = " << foo1(x1_min) << '\n';
    std::cout << "foo2: x = " << x2_min << " f(x) = " << foo2(x2_min) << '\n';
    std::cout << "foo3: x = " << x3_min << " f(x) = " << foo3(x3_min) << '\n';

    std::cout << "Dichotomy:\n";
    x1_min = min_dihotomia(0.0, 1.0, 1e-6, foo1);
    x2_min = min_dihotomia(0.0, 6.0, 1e-6, foo2);
    x3_min = min_dihotomia(0.0, 3.0, 1e-6, foo3);
    std::cout << "foo1: x = " << x1_min << " f(x) = " << foo1(x1_min) << '\n';
    std::cout << "foo2: x = " << x2_min << " f(x) = " << foo2(x2_min) << '\n';
    std::cout << "foo3: x = " << x3_min << " f(x) = " << foo3(x3_min) << '\n';

    std::cout << "Golden ratio:\n";
    x1_min = min_golden_ration(0.0, 1.0, 1e-6, foo1);
    x2_min = min_golden_ration(0.0, 6.0, 1e-6, foo2);
    x3_min = min_golden_ration(0.0, 3.0, 1e-6, foo3);
    std::cout << "foo1: x = " << x1_min << " f(x) = " << foo1(x1_min) << '\n';
    std::cout << "foo2: x = " << x2_min << " f(x) = " << foo2(x2_min) << '\n';
    std::cout << "foo3: x = " << x3_min << " f(x) = " << foo3(x3_min) << '\n';

    std::cout << "Fibonacci:\n";
    x1_min = min_Fibonacci(0.0, 1.0, 1e-6, foo1);
    x2_min = min_Fibonacci(0.0, 6.0, 1e-6, foo2);
    x3_min = min_Fibonacci(0.0, 3.0, 1e-6, foo3);
    std::cout << "foo1: x = " << x1_min << " f(x) = " << foo1(x1_min) << '\n';
    std::cout << "foo2: x = " << x2_min << " f(x) = " << foo2(x2_min) << '\n';
    std::cout << "foo3: x = " << x3_min << " f(x) = " << foo3(x3_min) << '\n';

    return 0;
}
