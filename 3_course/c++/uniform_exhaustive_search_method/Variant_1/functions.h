#pragma once
#include <cmath>

double foo9(double x) {
    return std::cos(x);
}

double foo14(double x) {
    return std::pow(x, 5) - 5 * std::pow(x, 3);
}

double foo16(double x) {
    return std::pow(x, 6) - 5 * std::pow(x, 2);
}

double foo19(double x) {
    return std::pow(x, 3) + 9 * x;
}

double foo27(double x) {
    return 6 * x * x - 12 * x;
}

double foo50(double x) {
    return (3 * std::pow(x, 4) - 12 * x) * std::cos(x);
}
