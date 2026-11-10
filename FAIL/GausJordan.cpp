
#include "matrix.hpp"
#include <cmath>

MyMatrix<double> gauss_jordan_solver(const MyMatrix<double>& matrix)
{
    MyMatrix<double> data = matrix;

    int rows = data.nrows();
    int cols = data.ncols();

    int pivotRow = 0;

    for (int col = 0; col < cols - 1 && pivotRow < rows; ++col)
    {
        int maxRow = pivotRow;

        for (int i = pivotRow + 1; i < rows; ++i)
        {
            if (std::abs(data[i][col]) > std::abs(data[maxRow][col]))
            {
                maxRow = i;
            }
        }

        if (std::abs(data[maxRow][col]) < 1e-10)
        {
            continue;
        }

        if (maxRow != pivotRow)
        {
            for (int j = 0; j < cols; ++j)
            {
                double temp = data[pivotRow][j];
                data[pivotRow][j] = data[maxRow][j];
                data[maxRow][j] = temp;
            }
        }

        double pivot = data[pivotRow][col];

        for (int j = 0; j < cols; ++j)
        {
            data[pivotRow][j] /= pivot;
        }

        for (int i = 0; i < rows; ++i)
        {
            if (i != pivotRow)
            {
                double factor = data[i][col];

                for (int j = 0; j < cols; ++j)
                {
                    data[i][j] -= factor * data[pivotRow][j];
                }
            }
        }

        ++pivotRow;
    }

    return data;
}
