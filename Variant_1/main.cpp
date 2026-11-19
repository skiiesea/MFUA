#include <iostream>
#include <iomanip>
#include <numbers>
#include "functions.h"
#include "plain_methods.h"

int main() {
    std::cout << std::fixed << std::setprecision(8);
    std::cout << "Uniform: " << std::endl;
    double x9_min = min_uniform_search(std::numbers::pi / 2, 3 * std::numbers::pi / 2, 1e-6, foo9);
    double x14_min = min_uniform_search(-(std::sqrt(3)), 0, 1e-6, foo14);
    double x16_min = min_uniform_search(0, 1, 1e-6, foo16);
    double x19_min = min_uniform_search(-1, 1, 1e-6, foo19);
    double x27_min = min_uniform_search(-4, 0, 1e-6, foo27);
    double x50_min = min_uniform_search(-2, 0, 1e-6, foo50);
    std::cout << "foo9: x = " << x9_min << " f(x) = " << foo9(x9_min) << '\n';
    std::cout << "foo14: x = " << x14_min << " f(x) = " << foo14(x14_min) << '\n';
    std::cout << "foo16: x = " << x16_min << " f(x) = " << foo16(x16_min) << '\n';
    std::cout << "foo19: x = " << x19_min << " f(x) = " << foo19(x19_min) << '\n';
    std::cout << "foo27: x = " << x27_min << " f(x) = " << foo27(x27_min) << '\n';
    std::cout << "foo50: x = " << x50_min << " f(x) = " << foo50(x50_min) << '\n';
    std::cout << "Localization: " << std::endl;
    x9_min = min_local(std::numbers::pi / 2, 3 * std::numbers::pi / 2, 1e-6, foo9);
    x14_min = min_local(-(std::sqrt(3)), 0, 1e-6, foo14);
    x16_min = min_local(0, 1, 1e-6, foo16);
    x19_min = min_local(-1, 1, 1e-6, foo19);
    x27_min = min_local(-4, 0, 1e-6, foo27);
    x50_min = min_local(-2, 0, 1e-6, foo50);
    std::cout << "foo9: x = " << x9_min << " f(x) = " << foo9(x9_min) << '\n';
    std::cout << "foo14: x = " << x14_min << " f(x) = " << foo14(x14_min) << '\n';
    std::cout << "foo16: x = " << x16_min << " f(x) = " << foo16(x16_min) << '\n';
    std::cout << "foo19: x = " << x19_min << " f(x) = " << foo19(x19_min) << '\n';
    std::cout << "foo27: x = " << x27_min << " f(x) = " << foo27(x27_min) << '\n';
    std::cout << "foo50: x = " << x50_min << " f(x) = " << foo50(x50_min) << '\n';
    std::cout << "Dichotomia: " << std::endl;
    x9_min = min_dihotomia(std::numbers::pi / 2, 3 * std::numbers::pi / 2, 1e-6, foo9);
    x14_min = min_dihotomia(-(std::sqrt(3)), 0, 1e-6, foo14);
    x16_min = min_dihotomia(0, 1, 1e-6, foo16);
    x19_min = min_dihotomia(-1, 1, 1e-6, foo19);
    x27_min = min_dihotomia(-4, 0, 1e-6, foo27);
    x50_min = min_dihotomia(-2, 0, 1e-6, foo50);
    std::cout << "foo9: x = " << x9_min << " f(x) = " << foo9(x9_min) << '\n';
    std::cout << "foo14: x = " << x14_min << " f(x) = " << foo14(x14_min) << '\n';
    std::cout << "foo16: x = " << x16_min << " f(x) = " << foo16(x16_min) << '\n';
    std::cout << "foo19: x = " << x19_min << " f(x) = " << foo19(x19_min) << '\n';
    std::cout << "foo27: x = " << x27_min << " f(x) = " << foo27(x27_min) << '\n';
    std::cout << "foo50: x = " << x50_min << " f(x) = " << foo50(x50_min) << '\n';
    std::cout << "Golden nation: " << std::endl;
    x9_min = min_golden_nation(std::numbers::pi / 2, 3 * std::numbers::pi / 2, 1e-6, foo9);
    x14_min = min_golden_nation(-(std::sqrt(3)), 0, 1e-6, foo14);
    x16_min = min_golden_nation(0, 1, 1e-6, foo16);
    x19_min = min_golden_nation(-1, 1, 1e-6, foo19);
    x27_min = min_golden_nation(-4, 0, 1e-6, foo27);
    x50_min = min_golden_nation(-2, 0, 1e-6, foo50);
    std::cout << "foo9: x = " << x9_min << " f(x) = " << foo9(x9_min) << '\n';
    std::cout << "foo14: x = " << x14_min << " f(x) = " << foo14(x14_min) << '\n';
    std::cout << "foo16: x = " << x16_min << " f(x) = " << foo16(x16_min) << '\n';
    std::cout << "foo19: x = " << x19_min << " f(x) = " << foo19(x19_min) << '\n';
    std::cout << "foo27: x = " << x27_min << " f(x) = " << foo27(x27_min) << '\n';
    std::cout << "foo50: x = " << x50_min << " f(x) = " << foo50(x50_min) << '\n';
    std::cout << "Fibonacci: " << std::endl;
    x9_min = min_Fibonacci(std::numbers::pi / 2, 3 * std::numbers::pi / 2, 1e-6, foo9);
    x14_min = min_Fibonacci(-(std::sqrt(3)), 0, 1e-6, foo14);
    x16_min = min_Fibonacci(0, 1, 1e-6, foo16);
    x19_min = min_Fibonacci(-1, 1, 1e-6, foo19);
    x27_min = min_Fibonacci(-4, 0, 1e-6, foo27);
    x50_min = min_Fibonacci(-2, 0, 1e-6, foo50);
    std::cout << "foo9: x = " << x9_min << " f(x) = " << foo9(x9_min) << '\n';
    std::cout << "foo14: x = " << x14_min << " f(x) = " << foo14(x14_min) << '\n';
    std::cout << "foo16: x = " << x16_min << " f(x) = " << foo16(x16_min) << '\n';
    std::cout << "foo19: x = " << x19_min << " f(x) = " << foo19(x19_min) << '\n';
    std::cout << "foo27: x = " << x27_min << " f(x) = " << foo27(x27_min) << '\n';
    std::cout << "foo50: x = " << x50_min << " f(x) = " << foo50(x50_min) << '\n';


}