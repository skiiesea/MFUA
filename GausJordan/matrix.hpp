#include <stdexcept>
#include <utility>
#include <iostream>

namespace {
    template <typename T> void construct(T *p, const T &rhs) { new (p) T(rhs);}
    template <typename T> void construct(T *p, T &&rhs) {
        new (p) T(std::move(rhs));
    }

    template <typename T> void destroy(T *p) { p->~T(); }
    template <typename FwdIter> void destroy(FwdIter first, FwdIter last) {
        while (first != last)
            destroy(&*first++);
    }

    template <typename T>
    class MyRowBuffer {
    protected:
        T *arr_;
        size_t ncols_;
    
    protected:
        MyRowBuffer(const MyRowBuffer&) = delete;
        MyRowBuffer& operator=(const MyRowBuffer&) = delete;
        MyRowBuffer(MyRowBuffer &&rhs) noexcept :
            arr_(rhs.arr_), ncols_(rhs.ncols_) {
                rhs.arr_ = nullptr;
                rhs.ncols_ = 0;
        }

        MyRowBuffer& operator=(MyRowBuffer &&rhs) noexcept {
            std::swap(arr_, rhs.arr_);
            std::swap(ncols_, rhs.ncols_);
            return *this;
        }

        MyRowBuffer(size_t ncols = 0) 
            : arr_((ncols == 0) ? nullptr 
                                : static_cast<T*>(::operator new(sizeof(T) * ncols))),
            ncols_(ncols) {}
        
        ~MyRowBuffer() {
            destroy(arr_, arr_ + ncols_);
            ::operator delete(arr_);
        }
    };

    template <typename T>
    class MatrixRow : private MyRowBuffer<T> {
    public:
        using MyRowBuffer<T>::arr_;
        using MyRowBuffer<T>::ncols_;

        explicit MatrixRow(size_t ncols = 0) : MyRowBuffer<T>(ncols) {}

        MatrixRow(MatrixRow &&rhs) = default;
        MatrixRow& operator=(MatrixRow &&rhs) = default;

        MatrixRow(const MatrixRow &rhs) : MyRowBuffer<T>(rhs.ncols_) {
            size_t current = 0;
            while (current < rhs.ncols_) {
                construct(arr_ + current, rhs.arr_[current]);
                ++current;
            }
        }

        MatrixRow& operator=(const MatrixRow& rhs) {
            if (this == &rhs) return *this;
            MatrixRow tmp{rhs};
            std::swap(*this, tmp);
            return *this;
        }

        T& operator[](size_t index) & { return arr_[index]; }
        const T& operator[](size_t index) const & {return arr_[index];}

        size_t ncols() const {return ncols_;}
    };
}

template <typename T>
class MyMatrix : private MyRowBuffer<MatrixRow<T>> {
private:
    using Rows = MyRowBuffer<MatrixRow<T>>;
    using Rows::arr_;
    using Rows::ncols_;
public:
    MyMatrix(MyMatrix &&rhs) = default;
    MyMatrix& operator=(MyMatrix&& rhs) = default;
    
    MyMatrix(const MyMatrix &rhs) : Rows(rhs.ncols_) {
        size_t current = 0;
        while (current < rhs.ncols_) {
            construct(arr_ + current, rhs.arr_[current]);
            ++current;
        }
    }

    MyMatrix& operator=(const MyMatrix& rhs) {
        if (this == &rhs) return *this;
        MyMatrix tmp{rhs};
        std::swap(*this, tmp);
        return *this;
    }     

    MyMatrix(size_t nrows, size_t ncols) : Rows(nrows) {
        size_t current = 0;
        while (current < nrows) {
            construct(arr_ + current, MatrixRow<T>(ncols));
            ++current;
        }
    }

    MatrixRow<T>& operator[](size_t index) & { return arr_[index]; }
    const MatrixRow<T>& operator[](size_t index) const & { return arr_[index]; }

    size_t nrows() const { return ncols_; }
    size_t ncols() const { 
        if (arr_ == nullptr) return 0;
        return arr_[0].ncols_; }

public:
    MyMatrix operator-() const noexcept {
        MyMatrix result(*this);
        for (size_t i = 0; i < ncols(); ++i)
            for (size_t j = 0; j < nrows(); ++j)
                result[j][i] = -result[j][i];
        return result;
    }

    MyMatrix& operator+=(const MyMatrix& rhs) {
        if (ncols() != rhs.ncols() || nrows() != rhs.nrows())
            throw std::invalid_argument("Matrix have to has same rows and same cols!");
        for (size_t i = 0; i < ncols(); ++i)
            for (size_t j = 0; j < nrows(); ++j)
                (*this)[j][i] += rhs[j][i];
        return *this;        
    }

    MyMatrix& operator-=(const MyMatrix& rhs) {
        (*this) += -rhs;
        return *this;
    }

    bool is_square() const noexcept { return ncols() == nrows();}
    bool is_diagonal() const noexcept {
        if (!is_square()) return false;
        for (size_t i = 0; i < nrows(); ++i)
            for (size_t j = 0; j < ncols(); ++j)
                if (i != j && (*this)[i][j] != 0) return false;
        return true;
    }

    MyMatrix transpose() const {
        MyMatrix result(ncols(), nrows());
        for (size_t i = 0; i < nrows(); ++i)
            for (size_t j = 0; j < ncols(); ++j)
                result[j][i] = (*this)[i][j];
        return result;
    }

    void dump(std::ostream& os) const {
        for (size_t i = 0; i < nrows(); ++i) {
            for (size_t j = 0; j < ncols(); ++j)
                os << (*this)[i][j] << '\t';
            os << '\n';
        }
    }

};

template <typename T>
std::ostream& operator<<(std::ostream& os, const MyMatrix<T>& m) {
    m.dump(os);
    return os;
}

template <typename T>
MyMatrix<T> operator+(const MyMatrix<T>& lhs, const MyMatrix<T>& rhs) {
    MyMatrix<T> result{lhs};
    result += rhs;
    return result;
}

template <typename T>
MyMatrix<T> operator-(const MyMatrix<T>& lhs, const MyMatrix<T>& rhs) {
    MyMatrix<T> result{lhs};
    result -= rhs;
    return result;
}

template <typename T, typename NUM>
MyMatrix<T> operator*(NUM num, const MyMatrix<T>& m) {
    MyMatrix<T> result{m};
    for (size_t i = 0; i < result.ncols(); ++i)
        for (size_t j = 0; j < result.nrows(); ++j)
            result[j][i] *= num;
    return result;
}

template <typename T, typename NUM>
MyMatrix<T> operator*(const MyMatrix<T>& m, NUM num) {
    return num * m;
}

template <typename T>
MyMatrix<T> matrix_multiply(const MyMatrix<T>& lhs, const MyMatrix<T>& rhs) {
    if (lhs.ncols() != rhs.nrows())
        throw std::invalid_argument("lhs ncols have to be equal rhs nrows");
    MyMatrix<T> result(lhs.nrows(), rhs.ncols());
    for (size_t i = 0; i < result.nrows(); ++i)
        for (size_t j = 0; j < result.ncols(); ++j) {
            result[i][j] = 0;
            for (size_t k = 0; k < lhs.ncols(); ++k)
                result[i][j] += lhs[i][k] * rhs[k][j];
        }
    return result;
}