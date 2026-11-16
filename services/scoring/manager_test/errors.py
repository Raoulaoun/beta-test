"""Statement errors. Each carries a stable code; the web app maps codes to copy.

Only the MT4 message is fixed by the spec. Copy for the other codes is still to be
approved, so `message` is an internal description, not user-facing text.
"""


class StatementError(Exception):
    code = "invalid_file"
    message = "The file could not be read as an MT5 report."

    def __init__(self, detail: str | None = None):
        super().__init__(detail or self.message)
        self.detail = detail


class FileTooLarge(StatementError):
    code = "file_too_large"
    message = "The file is larger than 10 MB."


class Mt4Statement(StatementError):
    code = "mt4_file"
    message = "This looks like an MT4 file, we only support MT5 for now"


class NotAReport(StatementError):
    code = "not_a_report"
    message = "The file is not an MT5 ReportHistory export."


class EmptyReport(StatementError):
    code = "empty_report"
    message = "The report has no closed trades."
