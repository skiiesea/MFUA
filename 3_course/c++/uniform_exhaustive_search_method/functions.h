#pragma once
#include <cmath>

double foo1(double x) { return -std::exp(-10000 * std::pow(x - 0.5, 2) + x); } 
double foo2(double x) { return std::pow(x - 3, 4); }
double foo3(double x) { return (x < 2) ? std::abs(x - 2) + 0.1 * x : 2 * x + 4; }